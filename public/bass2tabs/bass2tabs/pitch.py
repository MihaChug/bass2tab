"""Питч-трекинг CREPE (пакет torchcrepe) — инференс на MPS.

CREPE — монофонический детектор высоты: CNN поверх сырой волны выдаёт
распределение по 360 центовым бинам (по 20 центов, опора 10 Гц).
torchcrepe — канонический PyTorch-порт модели из PyPI, поэтому инференс
честно уходит на MPS через параметр device.

Длинный трек прогоняется чанками по 30 секунд с очисткой Metal-кэша между
ними и консервативными батчами на MPS — иначе Metal-драйвер macOS может
упасть в «Failed to allocate IOGPUDeviceShmem» (SIGABRT, не ловится
try/except). Сам инференс на MPS делегирован ДОЧЕРНЕМУ процессу: такой
abort убивает только его, а родитель повторяет прогон на CPU.

Установка: pip install "torchcrepe>=0.0.22"
Пакет называется torchcrepe — одним словом. Имени torch-mel-crepe в PyPI
не существует (отсюда ошибка pip "No matching distribution found").
"""

from __future__ import annotations

import sys
import time

import numpy as np
import torch

try:
    import torchcrepe
except ImportError as exc:  # pragma: no cover
    # ImportError здесь означает не обязательно «пакет не установлен»: так же
    # падает транзитивная зависимость при импорте torchcrepe (на macOS 26.3+
    # — почти наверняка scipy<=1.16 внутри librosa/torchcrepe,
    # «dlopen ... _spropack.so ... __thread_bss», см. scipy/scipy#25635).
    raise SystemExit(
        "Не удалось импортировать torchcrepe.\n"
        f"  причина: {exc}\n"
        "  если pip show torchcrepe находит пакет — проблема глубже: упала "
        "транзитивная зависимость (на macOS 26.3+ — почти наверняка "
        "scipy<=1.16, см. scipy/scipy#25635).\n"
        "  лечение: venv на Python 3.11+ (brew install python@3.12; "
        "python3.12 -m venv .venv; source .venv/bin/activate; "
        "pip install -r requirements.txt; pip install -e .)"
    ) from exc

# Рабочий диапазон 4-струнного баса с запасом на слэп-обертоны.
BASS_FMIN_HZ = 41.2    # E1 — открытая четвёртая струна
BASS_FMAX_HZ = 392.0   # G4 — верх типичного басового диапазона

# CREPE измеряет высоту в центах относительно 10 Гц: cents = 1200*log2(f/10)
_CENTS_REF_HZ = 10.0

# Чанки по 30 с: пиковые GPU-аллокации падают, Metal-кэш чистится между ними.
_CHUNK_SECONDS = 30.0
# Консервативный батч на MPS: меньше живых аллокаций — выше шанс, что
# драйвер Metal не abort'ит процесс (подстраховка — авто-откат на CPU).
_MPS_BATCH = 64


def progress_bar(done: int, total: int, label: str = "", width: int = 24) -> None:
    """Однострочный прогресс-бар (перезаписывает строку через \\r).

    Видим и из дочернего процесса: spawn наследует stdio родителя.
    """
    frac = done / total if total else 1.0
    filled = int(round(width * frac))
    bar = "█" * filled + "░" * (width - filled)
    sys.stdout.write(f"\r  {label} [{bar}] {int(frac * 100):3d}%")
    sys.stdout.flush()
    if done >= total:
        sys.stdout.write("\n")
        sys.stdout.flush()


def _medfilt1d(x: np.ndarray, kernel_size: int = 5) -> np.ndarray:
    """Бегущая медиана по нечётному окну, края дополняются нулями.

    Поведение один в один со scipy.signal.medfilt, но на чистом numpy:
    scipy убрана из пайплайна (на macOS 26.3+ её Fortran-расширения падают
    при импорте, см. scipy/scipy#25635).
    """
    x = np.asarray(x, dtype=np.float64).reshape(-1)
    if x.size == 0:
        return x
    k = int(kernel_size) | 1  # гарантируем нечётное окно
    pad = np.zeros(k // 2, dtype=x.dtype)
    windows = np.lib.stride_tricks.sliding_window_view(
        np.concatenate([pad, x, pad]), k)
    return np.median(windows, axis=1)


def _predict(audio, sr, hop, model, device, batch):
    """Один прогон CREPE на указанном устройстве."""
    with torch.inference_mode():
        pitch, confidence = torchcrepe.predict(
            audio, sr, hop,
            fmin=BASS_FMIN_HZ,
            fmax=BASS_FMAX_HZ,
            model=model,                          # "full" или "tiny"
            decoder=torchcrepe.decode.viterbi,    # сглаживание по бинам
            batch_size=batch,
            device=device,
            return_periodicity=True,
        )
    return pitch, confidence


def _crepe_pass(samples, sr, device, hop, model, batch):
    """Прогон CREPE по всему треку чанками на заданном устройстве."""
    audio = torch.as_tensor(samples, dtype=torch.float32).reshape(1, -1)
    step = max(hop, int(_CHUNK_SECONDS * sr) // hop * hop)  # кратен hop
    total = audio.shape[1]
    n_chunks = max(1, -(-total // step))

    pitches, confidences = [], []
    for idx, start in enumerate(range(0, total, step), start=1):
        part = audio[:, start:start + step]
        pitch, conf = _predict(part, sr, hop, model, device, batch)
        pitches.append(pitch.detach().float().cpu().numpy().reshape(-1))
        confidences.append(conf.detach().float().cpu().numpy().reshape(-1))
        if device.type == "mps" and hasattr(torch.mps, "empty_cache"):
            torch.mps.empty_cache()
        progress_bar(idx, n_chunks, f"CREPE {model} · чанк {idx}/{n_chunks}")

    return (np.concatenate(pitches).astype(np.float64),
            np.concatenate(confidences).astype(np.float64))


def _mps_worker(samples, sr, hop, model, batch, queue):
    """Цель дочернего процесса: CREPE на MPS, результат — в очередь (float32)."""
    try:
        pitch, conf = _crepe_pass(samples, sr, torch.device("mps"),
                                  hop, model, batch)
        queue.put(("ok", pitch.astype(np.float32), conf.astype(np.float32)))
    except Exception as exc:  # noqa: BLE001 — родителю уйдёт статус "err"
        queue.put(("err", repr(exc)))


def _run_mps_guarded(samples, sr, hop, model, batch):
    """MPS-инференс в дочернем процессе с авто-откатом на CPU.

    Metal-драйвер при нехватке общей памяти падает в SIGABRT
    («Failed to allocate IOGPUDeviceShmem») — такой abort нельзя перехватить
    try/except, он убивает процесс целиком. Поэтому тяжёлый прогон
    делегируется дочернему процессу; если тот гибнет (или вернул ошибку),
    родитель повторяет на CPU. Точки входа защищены guard'ом
    if __name__ == "__main__", так что spawn безопасен.

    ВАЖНО (анти-дедлок): результат вычитывается из очереди ДО join. Полезная
    нагрузка больше буфера pipe (~64 КБ), feeder-поток ребёнка блокируется на
    записи, и join до чтения повис бы навсегда (см. документацию Python:
    «все элементы очереди должны быть забраны до join'а»).
    """
    import multiprocessing as mp

    ctx = mp.get_context("spawn")
    queue = ctx.Queue()
    proc = ctx.Process(target=_mps_worker,
                       args=(samples, sr, hop, model, batch, queue))
    proc.start()

    result = None
    deadline = time.monotonic() + 1800  # страховочные 30 минут
    while True:
        try:
            status, *payload = queue.get(timeout=1.0)
            result = (status, payload)
            break
        except Exception:  # queue.Empty — продолжаем ждать
            if not proc.is_alive() and queue.empty():
                break
            if time.monotonic() > deadline:
                break

    proc.join(timeout=10)
    if proc.is_alive():
        proc.terminate()

    if result is not None and result[0] == "ok":
        pitch, conf = result[1]
        return pitch.astype(np.float64), conf.astype(np.float64)

    sys.stdout.write("\n")  # дочерний бар мог остаться без перевода строки
    if result is not None and result[0] == "err":
        print(f"  ! CREPE на MPS вернул ошибку ({result[1][0]}), повторяю на CPU")
    else:
        print(f"  ! MPS-процесс погиб (exitcode {proc.exitcode}) — похоже на "
              "abort Metal-драйвера, повторяю на CPU")
    return _crepe_pass(samples, sr, torch.device("cpu"), hop, model, batch)


def estimate_pitch(samples, sr, device, hop_ms=8.0, model="full", batch=None):
    """Прогнать CREPE и вернуть (f0 в Гц, периодичность 0..1, hop в сэмплах)."""
    hop = max(16, int(sr * hop_ms / 1000))
    # batch=None -> авто: 64 на MPS / 2048 на CPU. При склонности драйвера к
    # abort'ам уменьшайте вручную (флаг --batch: 32, 16, ...).
    if batch is None:
        batch = _MPS_BATCH if device.type == "mps" else 2048
    batch = max(16, int(batch))

    if device.type == "mps":
        pitch, confidence = _run_mps_guarded(samples, sr, hop, model, batch)
    else:
        pitch, confidence = _crepe_pass(samples, sr, device, hop, model, batch)

    # Медианный фильтр (чистый numpy) добивает одиночные октавные скачки.
    confidence = _medfilt1d(confidence, 5)
    return pitch, confidence, hop


def hz_to_cents(pitch_hz: np.ndarray) -> np.ndarray:
    """f0 (Гц) -> центы относительно 10 Гц; неозвученные фреймы = NaN."""
    cents = np.full_like(pitch_hz, np.nan, dtype=np.float64)
    voiced = pitch_hz > 0
    cents[voiced] = 1200.0 * np.log2(pitch_hz[voiced] / _CENTS_REF_HZ)
    return cents
