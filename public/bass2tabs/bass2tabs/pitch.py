"""Питч-трекинг CREPE на MPS (torchcrepe).

Устойчивость к «аллергичному» Metal-драйверу (macOS 26.3+ abort'ит крупные
GPU-аллокации, IOGPUDeviceShmem):
  * трек режется на чанки по 30 c с очисткой Metal-кэша между ними;
  * батчи на MPS уменьшены (см. --batch);
  * весь MPS-прогон идёт в ДОЧЕРНЕМ процессе: если драйвер его убивает
    (SIGABRT нельзя перехватить в Python), родитель повторяет на CPU;
  * результат вычитывается из очереди ДО join (иначе дедлок feeder-потока).

Медианный фильтр уверенности — чистый numpy, без scipy.
"""

from __future__ import annotations

import multiprocessing as mp
import sys
import time

import numpy as np
import torch

try:
    import torchcrepe
except Exception as exc:  # pragma: no cover
    raise RuntimeError(
        f"Не найден torchcrepe (причина: {exc}). "
        'Выполните: pip install "torchcrepe>=0.0.22"'
    ) from exc

CHUNK_SECONDS = 30.0     # длина чанка инференса
FMIN, FMAX = 32.0, 500.0  # Гц (фильтр по MIDI-диапазону — в notes.py)


def _medfilt1d(x: np.ndarray, k: int = 5) -> np.ndarray:
    """Одномерный медианный фильтр, семантика scipy medfilt(k): нулевой
    паддинг, нечётное окно. Чистый numpy, без scipy."""
    if x.size < 3 or k < 3:
        return x.copy()
    pad = k // 2
    padded = np.pad(x, pad, mode="constant", constant_values=0)
    windows = np.lib.stride_tricks.sliding_window_view(padded, k)
    return np.median(windows, axis=1)


def progress_bar(done: int, total: int, label: str = "", width: int = 24) -> None:
    """Однострочный прогресс-бар, видимый и из дочернего процесса (stdio)."""
    frac = done / max(1, total)
    filled = int(round(frac * width))
    bar = "█" * filled + "░" * (width - filled)
    sys.stdout.write(f"\r  {label} [{bar}] {frac * 100:3.0f}%")
    sys.stdout.flush()
    if done >= total:
        sys.stdout.write("\n")
        sys.stdout.flush()


def _crepe_pass(audio, sr, hop, model, device, batch) -> tuple[np.ndarray, np.ndarray]:
    """Прогон CREPE по чанкам на заданном устройстве."""
    n = audio.numel()
    chunk = int(CHUNK_SECONDS * sr)
    n_chunks = max(1, -(-n // chunk))
    all_pitch, all_conf = [], []

    for ci in range(n_chunks):
        seg = audio[ci * chunk:(ci + 1) * chunk]
        t0 = time.perf_counter()
        pitch, conf = torchcrepe.predict(
            seg.unsqueeze(0), sr, hop_length=hop, fmin=FMIN, fmax=FMAX,
            model=model, return_periodicity=True, device=device,
            batch_size=batch, pad=True, decoder=torchcrepe.decode.viterbi)
        all_pitch.append(pitch.squeeze(0).double().cpu().numpy())
        all_conf.append(conf.squeeze(0).double().cpu().numpy())
        if device.type != "mps":
            elapsed = time.perf_counter() - t0
            progress_bar(ci + 1, n_chunks,
                         f"CREPE {model} · чанк {ci + 1}/{n_chunks} · {elapsed:.0f} c")
        if device.type == "mps" and ci + 1 < n_chunks:
            torch.mps.empty_cache()
        if device.type == "mps":
            progress_bar(ci + 1, n_chunks,
                         f"CREPE {model} · чанк {ci + 1}/{n_chunks}")

    return np.concatenate(all_pitch), np.concatenate(all_conf)


def _mps_worker(q, audio, sr, hop, model, batch):
    """Рабочий MPS-процесс: кладёт (pitch, confidence) в очередь float32."""
    try:
        pitch, conf = _crepe_pass(audio, sr, hop, model,
                                  torch.device("mps"), batch)
        q.put((pitch.astype(np.float32), conf.astype(np.float32)))
    except BaseException as exc:  # pragma: no cover
        q.put(("error", repr(exc)))


def _run_mps_guarded(audio, sr, hop, model, batch):
    """MPS-инференс в дочернем процессе с авто-откатом на CPU.

    Результат вычитывается из очереди ДО join — иначе дедлок: большой
    массив не помещается в буфер pipe, feeder-поток ребёнка блокируется,
    а join ждёт завершения ребёнка (правило из документации Python).
    """
    ctx = mp.get_context("spawn")
    q = ctx.Queue()
    proc = ctx.Process(target=_mps_worker, args=(q, audio, sr, hop, model, batch))
    proc.start()

    result, deadline = None, time.time() + 1800
    while result is None:
        try:
            result = q.get(timeout=1.0)
        except Exception:
            if not proc.is_alive() and q.empty():
                break
            if time.time() > deadline:
                proc.kill()
                break
    proc.join(timeout=10)
    if proc.is_alive():
        proc.kill()

    if isinstance(result, tuple) and len(result) == 2 \
            and isinstance(result[0], np.ndarray):
        return result[0].astype(np.float64), result[1].astype(np.float64)

    print("\n  ! MPS-процесс погиб (вероятно, abort Metal-драйвера) — повторяю на CPU",
          flush=True)
    return _crepe_pass(audio, sr, hop, model, torch.device("cpu"), batch * 2)


def estimate_pitch(samples, sr, device, model="full", hop_ms=8.0, batch=0):
    """Вернуть (cents, confidence, hop).

    cents — относительно опоры 10 Гц (midi = cents/100 + 3.4868).
    """
    hop = max(1, int(round(sr * hop_ms / 1000.0)))
    hop -= hop % 160                      # сетка CREPE кратна 160 на 16 kHz
    if batch <= 0:
        batch = 64 if device.type == "mps" else 2048

    if device.type == "mps":
        pitch_hz, confidence = _run_mps_guarded(samples, sr, hop, model, batch)
    else:
        pitch_hz, confidence = _crepe_pass(samples, sr, hop, model, device, batch)

    with np.errstate(divide="ignore", invalid="ignore"):
        cents = 100.0 * np.log2(np.maximum(pitch_hz, 1e-6) / 10.0)
    cents[~np.isfinite(cents)] = np.nan

    # Медианный фильтр (чистый numpy) добивает одиночные октавные скачки
    # декодера — без scipy, чтобы не зависеть от её бинарных расширений.
    confidence = _medfilt1d(confidence, 5)
    return cents, confidence, hop
