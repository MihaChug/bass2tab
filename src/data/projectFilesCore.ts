export type ProjectFile = {
  path: string;
  lang: "python" | "markdown" | "ini";
  group: "Обвязка" | "Ядро" | "Экспорт";
  note: string;
  code: string;
};

const readme = String.raw`# bass2tabs

Транскрибация партии бас-гитары из аудио (wav / flac / mp3) в
**MIDI**, **MusicXML** и **Guitar Pro 5 (.gp5)**. Работает полностью
локально, без облаков; инференс питч-трекинга исполняется на GPU Apple
Silicon через бэкенд **MPS** (PyTorch).

Пайплайн рассчитан на моносигнал (одна басовая дорожка, по одной ноте
за раз) — разделение микса на стеки НЕ требуется.

## Возможности

- загрузка wav / flac / mp3 через soundfile (libsndfile), фолбэк — ffmpeg
  CLI. Не используется torchaudio.load, поэтому не нужен torchcodec;
- предобработка на CPU: моно-миксдаун, ресемплинг до 16 kHz, highpass 30 Гц,
  нормализация пика до −1 dBFS (GPU-память впервые выделяется уже внутри
  защищённого дочернего процесса — драйверный abort не убивает прогон);
- питч-трекинг CREPE (full) через torchcrepe, декодирование Витерби,
  медианная фильтрация контура;
- детекция онсетов (librosa) → сегментация контура → привязка к ближайшему
  полутону в центовом пространстве, диапазон E1–G4 (настраивается);
- velocity из RMS-энергии атаки, авто-оценка темпа (beat_track) или --tempo;
- квантизация на сетку 1/16 (или 1/8, 1/4);
- экспорт: .mid (mido), .musicxml (собственный writer, басовый ключ, связи),
  .gp5 (PyGuitarPro, 4-струнный строй E–A–D–G, эвристика минимального лада).

## Требования

- macOS 12.3+ на Apple Silicon (M1/M2/M3/M4), Python 3.10+
  (на macOS 26.3+ Tahoe нужен Python 3.11+ — см. «Диагностику»);
- ffmpeg (для mp3): brew install ffmpeg;
- torch >= 2.1 arm64-сборка — MPS включится автоматически.

## Структура проекта

    bass2tabs/                     <- корень проекта (этот каталог)
    ├── README.md
    ├── requirements.txt
    ├── pyproject.toml
    └── bass2tabs/                 <- Python-пакет (вложенный, то же имя!)
        ├── __init__.py
        ├── __main__.py            # python -m bass2tabs
        ├── cli.py
        ├── mps.py  audio.py  pitch.py  notes.py
        └── midi.py  musicxml.py  gp5.py

Критично: пакет лежит ВНУТРИ каталога проекта и называется ровно
«bass2tabs» — иначе будет «No module named bass2tabs».

## Установка

    brew install ffmpeg
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    pip install -e .                 # регистрация пакета в окружении
    python -m bass2tabs --check      # диагностика MPS

«pip install -e .» — штатная защита от «No module named bass2tabs»:
после неё команда работает из любой директории, а в PATH появляется
консольная команда «bass2tabs».

## Быстрый старт

    bass2tabs take.wav -o out --formats midi,musicxml,gp5   # или python -m bass2tabs ...
    python -m bass2tabs slap.flac --device mps --model full --grid 16 --tempo 112
    python -m bass2tabs demo.mp3 --range E1:E4 --min-duration 0.06 -v

## Флаги CLI

| флаг             | по умолчанию | смысл                                            |
|------------------|--------------|--------------------------------------------------|
| --formats        | все три      | подмножество midi, musicxml, gp5                 |
| --device         | auto         | auto / mps / cpu / cuda                          |
| --hop-ms         | 8            | шаг питч-трекинга, мс (5–10)                     |
| --model          | full         | ёмкость CREPE: full / tiny                       |
| --batch          | авто         | батч CREPE (256 mps / 2048 cpu); ↓ при Metal-абортах |
| --confidence     | 0.5          | порог уверенности голосовых фреймов              |
| --min-duration   | 0.08         | минимальная длительность ноты, с                 |
| --range          | E1:G4        | допустимый диапазон (нотные имена)               |
| --grid           | 16           | сетка квантизации: 4 / 8 / 16                    |
| --tempo          | авто         | фиксированный BPM вместо оценки                  |
| --program        | 34           | MIDI-программа (33 finger / 34 pick / 35 slap)   |
| --title/--artist | имя файла    | метаданные MusicXML и GP5                        |
| -v, --verbose    | выкл         | печатать сводку по каждой ноте                   |
| --check          | —            | диагностика окружения и MPS                      |

## Как это устроено (коротко)

1. soundfile (или ffmpeg-CLI как фолбэк) читает файл, моно-сигнал 16 kHz
   уходит на MPS;
   biquad-highpass 30 Гц убирает сценический гул, пик нормализуется.
2. CREPE (модель full, ~24.4M параметров) считает вероятность 360 центовых
   бинов на фрейм; декодер Витерби по матрице переходов даёт гладкий контур
   f0; затем медианный фильтр 5 фреймов добивает одиночные выбросы.
3. librosa.onset находит атаки (с backtrack к фронту), контур режется на
   сегменты; медиана центов сегмента округляется до полутона
   (midi = cents/100 + 3.4868, опорная 10 Гц).
4. Темп — librosa.beat.beat_track с приведением к 70–170 BPM; старты и
   длительности снэпаются к сетке, перекрытия укорачиваются.
5. MIDI пишется дельта-событиями (480 tpq); MusicXML — partwise с басовым
   ключом и tie-связками на границах тактов; GP5 — через PyGuitarPro,
   нота маппится в (струна, лад) минимальным ладом.

## Диагностика

- «No module named bass2tabs» → команда запущена не из корня проекта
  (там должен лежать каталог bass2tabs/ с __init__.py). Кардинальное
  решение: из корня проекта выполнить pip install -e . — после этого
  python -m bass2tabs (и просто bass2tabs) работает откуда угодно;
- ImportError dlopen _spropack.so / «__thread_bss ... offset field is
  not zero» (или «Не найден torchcrepe» при УСТАНОВЛЕННОМ пакете — это
  та же причина, только упавшая внутри import torchcrepe) → битые
  Mach-O-секции scipy ≤ 1.16 на macOS Tahoe 26.3+ (scipy/scipy#25635).
  Сам bass2tabs scipy больше не импортирует, НО её при импорте грузят
  транзитивные зависимости librosa и torchcrepe. Единственное надёжное
  лечение: пересоздать venv на Python 3.11+ — туда встанет scipy ≥ 1.17
  с переписанным на C PROPACK:
      brew install python@3.12
      python3.12 -m venv .venv && source .venv/bin/activate
      pip install -r requirements.txt && pip install -e .
- «Assertion failed: Failed to allocate IOGPUDeviceShmem» и zsh: abort →
  крах Metal-драйвера от слишком крупных GPU-аллокаций (SIGABRT, не
  ловится try/except). В коде это закрыто: CREPE на MPS прогоняется в
  ДОЧЕРНЕМ процессе, и при его гибели родитель автоматически повторяет
  на CPU — транскрибация завершится в любом случае. Плюс чанки по 30 с,
  очистка кэша Metal и PYTORCH_ENABLE_MPS_FALLBACK=1. Чтобы остаться на
  GPU и снизить шанс аборта: --batch 128 / --batch 64; гарантированный
  обход — --device cpu.
- виснет на «чанк N/N … 100%» при нулевой загрузке CPU → дедлок очереди
  multiprocessing (join ДО get). В текущем pitch.py исправлено: результат
  вычитывается из очереди ДО join; обновите файл и перезапустите;
- MPS недоступен → macOS < 12.3 или x86-сборка torch (проверьте file
  $(python -c "import torch; print(torch.__file__)"));
- ноты «дробятся» → поднимите --min-duration или --confidence;
- гудящие призраки на паузах → CREPE уверен на тишине редко: поднимите
  --confidence до 0.6–0.7;
- pip: «No matching distribution found for torch-mel-crepe» → пакета с
  таким именем в PyPI нет, он называется torchcrepe (одно слово, без
  дефисов): pip install "torchcrepe>=0.0.22";
- pip: «No matching distribution found for guitarpro» → дистрибутив
  называется PyGuitarPro, при этом в коде import guitarpro:
  pip install "PyGuitarPro>=0.6".

## Лицензия

MIT. Зависимости: torch, torchaudio (только DSP-функционал), torchcrepe,
librosa, soundfile, numpy,
mido, PyGuitarPro (import guitarpro). scipy не используется: на macOS
Tahoe 26.3+ её бинарные расширения падают при импорте (dyld,
scipy/scipy#25635) — медианные фильтры реализованы на чистом numpy.
`;

const requirements = String.raw`# bass2tabs — зависимости
# torch/torchaudio: arm64-сборки для Apple Silicon (MPS)
torch>=2.1
torchaudio>=2.1

# питч-трекинг CREPE на чистом torch (инференс идёт на MPS)
# ВАЖНО: пакет в PyPI называется torchcrepe — одним словом, без дефисов.
# (torch-mel-crepe не существует: pip отдаст "No matching distribution found")
torchcrepe>=0.0.22,<0.1

# DSP: онсеты и темп — librosa; медианные фильтры — чистый numpy.
# scipy из прямых зависимостей УБРАНА: на macOS Tahoe 26.3+ её
# Fortran-расширения падают при импорте (dyld + _spropack.so,
# scipy/scipy#25635). Транзитивно она всё равно приедет с librosa,
# но bass2tabs её больше не импортирует.
librosa>=0.10
numpy>=1.24,<2.1

# Чтение wav/flac/mp3 — через soundfile (libsndfile), НЕ через
# torchaudio.load: в torchaudio>=2.6 load() требует torchcodec, а
# soundfile стабилен и уже стоит как зависимость librosa.
soundfile>=0.12

# экспорт
mido>=1.3            # Standard MIDI File
PyGuitarPro>=0.6     # дистрибутив в PyPI; в коде импортируется как import guitarpro (GP3–GP5)
`;

const pyproject = String.raw`# bass2tabs — метаданные пакета. После
#     pip install -e .
# команда python -m bass2tabs работает из ЛЮБОЙ директории (пакет
# регистрируется в окружении), а в PATH появляется консольная команда
# bass2tabs. Это штатная защита от «No module named bass2tabs».

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "bass2tabs"
version = "0.1.0"
description = "Транскрибация бас-гитары: wav/flac/mp3 -> MIDI / MusicXML / GP5 (torch, Apple Silicon MPS)"
readme = "README.md"
requires-python = ">=3.10"
license = { text = "MIT" }
keywords = ["bass", "transcription", "midi", "musicxml", "guitar-pro", "mps", "apple-silicon"]
dependencies = [
    "torch>=2.1",
    "torchaudio>=2.1",
    "torchcrepe>=0.0.22,<0.1",
    "librosa>=0.10",
    "numpy>=1.24,<2.1",
    "soundfile>=0.12",
    "mido>=1.3",
    "PyGuitarPro>=0.6",
]

[project.scripts]
bass2tabs = "bass2tabs.cli:main"

[tool.setuptools]
packages = ["bass2tabs"]
`;

const initPy = String.raw`"""bass2tabs — транскрибация бас-гитары: аудио -> MIDI / MusicXML / GP5."""

__version__ = "0.1.0"
__all__ = ["__version__"]
`;

const mainPy = String.raw`"""Точка входа: python -m bass2tabs ..."""

from .cli import main

if __name__ == "__main__":
    raise SystemExit(main())
`;

const mpsPy = String.raw`"""Выбор устройства и диагностика Apple Silicon / MPS.

MPS (Metal Performance Shaders) — GPU-бэкенд PyTorch для Apple Silicon.
На M-чипах он даёт ускорение инференса CREPE в ~5-15 раз против CPU
(зависит от длины дорожки и ёмкости модели).
"""

from __future__ import annotations

import platform
import sys

import torch


def pick_device(preferred: str = "auto") -> torch.device:
    """Вернуть устройство: 'auto' предпочитает MPS, затем CUDA, затем CPU."""
    preferred = (preferred or "auto").lower()
    if preferred == "cpu":
        return torch.device("cpu")

    has_mps = (
        getattr(torch.backends, "mps", None) is not None
        and torch.backends.mps.is_available()
    )
    if preferred in ("mps", "auto") and has_mps:
        return torch.device("mps")
    if preferred == "mps":
        raise RuntimeError(
            "MPS недоступен: нужны macOS >= 12.3 и arm64-сборка torch >= 1.12. "
            "Проверьте: python -m bass2tabs --check"
        )
    if preferred in ("cuda", "auto") and torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def describe(device: torch.device) -> str:
    """Короткая сводка об окружении для стартового лога."""
    lines = [
        f"torch {torch.__version__} · python {sys.version.split()[0]}",
        f"macOS {platform.mac_ver()[0] or 'n/a'} · {platform.machine()}",
        f"устройство: {device}",
    ]
    if device.type == "mps":
        try:
            alloc = torch.mps.current_allocated_memory() / 2**20
            lines.append(f"mps: на старте выделено {alloc:.1f} MiB")
        except Exception:
            pass
    return "\n".join(lines)


def check() -> int:
    """Диагностика --check: версии, доступность MPS, тестовый matmul."""
    print("bass2tabs · проверка окружения")
    print(f"  torch            {torch.__version__}")
    try:
        import torchcrepe  # noqa: F401 — проверяем, что импорт целиком здоров
        # У torchcrepe нет атрибута __version__ — берём версию из
        # метаданных установленного дистрибутива (dist-info).
        from importlib.metadata import PackageNotFoundError
        from importlib.metadata import version as _pkg_version
        try:
            print(f"  torchcrepe       {_pkg_version('torchcrepe')}")
        except PackageNotFoundError:
            print("  torchcrepe       установлен")
    except ImportError as exc:
        print(f"  torchcrepe       импорт не удался: {exc}")
        print("                     если pip show находит пакет — упала транзитивная "
              "зависимость; на macOS 26.3+ это scipy<=1.16 (нужен Python 3.11+)")
    print(f"  python           {sys.version.split()[0]}")
    print(f"  система          macOS {platform.mac_ver()[0] or 'n/a'} · {platform.machine()}")

    has_mps = (
        getattr(torch.backends, "mps", None) is not None
        and torch.backends.mps.is_available()
    )
    print(f"  MPS доступен     {'да' if has_mps else 'НЕТ'}")
    if not has_mps:
        print("  -> обновите macOS до 12.3+ и поставьте arm64-сборку torch")

    device = pick_device("auto")
    print(f"  авто-устройство  {device}")

    x = torch.randn(1024, 1024, device=device)
    y = (x @ x.T).sum()
    print(f"  тестовый matmul  {y.item():.3f}  [ok]")
    return 0 if has_mps else 1
`;

const audioPy = String.raw`"""Загрузка и предобработка аудио.

Чтение намеренно НЕ через torchaudio.load: в torchaudio >= 2.6 старые
бэкенды (soundfile/ffmpeg) убрали, и load() требует отдельный пакет
torchcodec (ImportError: "TorchCodec is required"). Вместо этого:
  1) soundfile (libsndfile) — wav/flac нативно, mp3 на libsndfile>=1.1;
  2) ffmpeg CLI — фолбэк для mp3 и всего, что умеет ffmpeg.

Про MPS важно: на ряде macOS (в частности 27.0) драйвер Metal abort'ит
процесс при первом же крупном выделении общей GPU-памяти
(IOGPUDeviceShmem), и SIGABRT не ловится try/except. Поэтому вся
предобработка — миксдаун, ресемплинг, highpass, нормализация — считается
на CPU: это секунды работы и гарантированно безопасно. В GPU сигнал
уходит только внутри estimate_pitch, где MPS-инференс запущен в
дочернем процессе с авто-откатом на CPU (см. pitch.py).
"""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torchaudio

TARGET_SR = 16_000  # рабочая частота дискретизации для CREPE


@dataclass
class AudioClip:
    samples: np.ndarray   # float32, моно, 16 kHz
    sr: int
    source_sr: int
    path: Path
    seconds: float


def _read_audio(path: Path):
    """(тензор [каналы, сэмплы] float32, sr). soundfile -> ffmpeg-CLI."""
    # 1) soundfile / libsndfile: wav, flac (и mp3 на libsndfile>=1.1)
    try:
        import soundfile as sf
        data, sr = sf.read(str(path), dtype="float32", always_2d=True)
        return torch.from_numpy(np.ascontiguousarray(data.T)), int(sr)
    except Exception:
        pass

    # 2) ffmpeg CLI: mp3 и всё остальное
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise RuntimeError(
            f"soundfile не смог прочитать {path.name}, а ffmpeg/ffprobe "
            "не найдены в PATH. Установите: brew install ffmpeg"
        )
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json",
         "-show_streams", str(path)],
        capture_output=True, text=True, check=True,
    )
    info = next(s for s in json.loads(probe.stdout)["streams"]
                if s.get("codec_type") == "audio")
    sr = int(info["sample_rate"])
    ch = int(info.get("channels", 2))
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path),
         "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1"],
        capture_output=True, check=True,
    ).stdout
    data = np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).T
    return torch.from_numpy(np.ascontiguousarray(data)), sr


def load_clip(path: Path) -> AudioClip:
    """Загрузить файл, смикшировать в моно и ресемплировать до 16 kHz.

    Всё на CPU: торчим в GPU появится только под защитой дочернего
    процесса (см. модуль pitch), поэтому driver-level abort нам не страшен.
    """
    if not path.exists():
        raise FileNotFoundError(f"файл не найден: {path}")

    wav, sr = _read_audio(path)                      # [каналы, сэмплы], CPU
    wav = wav.to(dtype=torch.float32)
    if wav.shape[0] > 1:
        wav = wav.mean(dim=0, keepdim=True)

    if sr != TARGET_SR:
        wav = torchaudio.functional.resample(
            wav, sr, TARGET_SR,
            lowpass_filter_width=64,
            rolloff=0.9475,
            resampling_method="sinc_interp_kaiser",
            beta=14.769656439379182,
        )

    wav = preprocess(wav)
    samples = wav.squeeze(0).clamp(-1.0, 1.0).numpy().astype(np.float32)
    return AudioClip(samples, TARGET_SR, sr, path, samples.shape[0] / TARGET_SR)


def preprocess(wav: torch.Tensor) -> torch.Tensor:
    """Highpass 30 Гц против сценического гула + нормализация пика до −1 dBFS."""
    wav = torchaudio.functional.highpass_biquad(
        wav, TARGET_SR, cutoff_freq=30.0, Q=0.707
    )
    peak = wav.abs().max()
    if peak > 1e-6:
        target = 10 ** (-1.0 / 20.0)  # −1 dBFS
        wav = wav * (target / peak)
    return wav


def frame_rms(samples: np.ndarray, hop: int, win: int = 1024) -> np.ndarray:
    """RMS-энергия по фреймам (для velocity). Операция лёгкая — считаем на CPU,
    чтобы не плодить GPU-аллокации вне защищённого дочернего процесса."""
    x = torch.from_numpy(samples)
    frames = x.unfold(0, win, hop) if x.numel() >= win else x.view(1, -1)
    rms = frames.pow(2).mean(dim=1).sqrt()
    return rms.numpy()
`;

const pitchPy = String.raw`"""Питч-трекинг CREPE (чистый PyTorch, пакет torchcrepe) — инференс на MPS.

CREPE — монофонический детектор высоты: CNN поверх сырой волны выдаёт
распределение по 360 центовым бинам (по 20 центов, опора 10 Гц).
torchcrepe — канонический PyTorch-порт модели из PyPI, поэтому инференс
честно уходит на MPS через параметр device.

Длинный трек прогоняется чанками по 30 секунд с очисткой Metal-кэша
между ними и мелкими батчами на MPS — иначе Metal-драйвер macOS может
упасть в «Failed to allocate IOGPUDeviceShmem» (abort, не ловится
try/except). При сбое отдельного чанка на Metal он и весь остаток
дочитываются на CPU.

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
    # ВАЖНО: ImportError здесь означает не обязательно «пакет не установлен».
    # Так же падает ТРАНЗИТИВНАЯ зависимость при импорте torchcrepe:
    # на macOS 26.3+ (Tahoe) это почти наверняка scipy <= 1.16 внутри
    # librosa/torchcrepe — «dlopen ... _spropack.so ... __thread_bss»
    # (scipy/scipy#25635). Поэтому печатаем истинную причину.
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

# CREPE измеряет высоту в центах относительно 10 Гц:
# cents = 1200 * log2(f / 10)
_CENTS_REF_HZ = 10.0

# Трек прогоняется 30-секундными чанками: пиковые GPU-аллокации падают,
# а Metal-кэш чистится между чанками — защита от драйверного abort
# «Failed to allocate IOGPUDeviceShmem» (Metal-драйвер macOS не ловится
# try/except, поэтому не даём ему повода: меньше одновременных буферов).
_CHUNK_SECONDS = 30.0
_MPS_BATCH = 64        # консервативный батч на MPS: меньше живых аллокаций,
                       # выше шанс, что драйвер Metal не abort'ит процесс
                       # (подстраховка — авто-откат на CPU в estimate_pitch)


def _medfilt1d(x: np.ndarray, kernel_size: int = 5) -> np.ndarray:
    """Бегущая медиана по окну kernel_size (нечётному), края дополняются нулями.

    Поведение один в один со scipy.signal.medfilt для одномерного входа,
    но на чистом numpy. scipy из пайплайна убран сознательно: на macOS
    Tahoe 26.3+ её Fortran-расширения перестали проходить ужесточённую
    проверку dyld (ImportError dlopen _spropack.so, секция __thread_bss;
    см. scipy/scipy#25635), а нам от неё нужна была ровно эта функция.
    """
    x = np.asarray(x, dtype=np.float64).reshape(-1)
    if x.size == 0:
        return x
    k = int(kernel_size) | 1  # гарантируем нечётное окно
    pad = np.zeros(k // 2, dtype=x.dtype)
    windows = np.lib.stride_tricks.sliding_window_view(
        np.concatenate([pad, x, pad]), k
    )
    return np.median(windows, axis=1)


def progress_bar(done: int, total: int, label: str, width: int = 24) -> None:
    """Однострочный прогресс-бар: перезаписывает текущую строку через \\r.

    Видим и из дочернего процесса (stdio наследуется), поэтому бар CREPE
    показывается, даже когда инференс идёт в защищённом subprocess'е.
    Завершающий перевод строки делает вызывающий код.
    """
    pct = done / total if total else 1.0
    filled = int(round(pct * width))
    sys.stdout.write(
        f"\r  {label} [" + "\u2588" * filled + "\u2591" * (width - filled)
        + f"] {pct * 100:3.0f}%  "
    )
    sys.stdout.flush()


def _predict(audio: torch.Tensor, sr: int, hop: int, model: str,
             device: torch.device, batch: int):
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


def _crepe_pass(samples: np.ndarray, sr: int, device: torch.device,
                hop: int, model: str, batch: int):
    """Прогон CREPE по всему треку чанками на заданном устройстве.

    Возвращает (pitch, confidence) — numpy-массивы float64. Чанки кратны
    hop, поэтому сетка фреймов не «едет» на стыках; после каждого чанка
    чистим кэш Metal, чтобы не коптить драйвер живыми аллокациями.
    """
    audio = torch.as_tensor(samples, dtype=torch.float32).reshape(1, -1)
    step = max(hop, int(_CHUNK_SECONDS * sr) // hop * hop)
    starts = list(range(0, audio.shape[1], step))
    total = len(starts)
    pitches, confidences = [], []
    t0 = time.perf_counter()
    for ci, start in enumerate(starts):
        part = audio[:, start:start + step]
        pitch, conf = _predict(part, sr, hop, model, device, batch)
        pitches.append(pitch.detach().float().cpu().numpy().reshape(-1))
        confidences.append(conf.detach().float().cpu().numpy().reshape(-1))
        if device.type == "mps" and hasattr(torch.mps, "empty_cache"):
            torch.mps.empty_cache()
        progress_bar(ci + 1, total,
                     f"CREPE {model} · чанк {ci + 1}/{total}"
                     f" · {time.perf_counter() - t0:.0f} c")
    sys.stdout.write("\n")
    sys.stdout.flush()
    return (np.concatenate(pitches).astype(np.float64),
            np.concatenate(confidences).astype(np.float64))


def _mps_worker(samples, sr, hop, model, batch, queue):
    """Цель дочернего процесса: CREPE на MPS, результат — в очередь.

    Через pipe отправляем float32: точности для f0 в Гц хватает с запасом,
    а полезная нагрузка вдвое меньше — меньше шанс упереться в буфер pipe.
    """
    try:
        pitch, conf = _crepe_pass(samples, sr, torch.device("mps"),
                                  hop, model, batch)
        queue.put(("ok", pitch.astype(np.float32), conf.astype(np.float32)))
    except Exception as exc:  # noqa: BLE001 — родителю уйдёт статус "err"
        queue.put(("err", repr(exc)))


def _run_mps_guarded(samples, sr, hop, model, batch, timeout: float = 1800.0):
    """MPS-инференс в дочернем процессе с авто-откатом на CPU.

    Metal-драйвер macOS при нехватке общей памяти падает в SIGABRT
    («Failed to allocate IOGPUDeviceShmem») — такой abort невозможно
    перехватить try/except, он убивает процесс целиком. Поэтому тяжёлый
    прогон делегируется дочернему процессу: если тот гибнет (exitcode
    != 0) или сообщает об ошибке, родитель спокойно повторяет на CPU.
    Точки входа (__main__.py, console-script) защищены guard'ом
    if __name__ == "__main__", так что spawn безопасен.

    ВАЖНО про очередь: результат (pitch + confidence, сотни КБ) надо
    вычитывать ИЗ ОЧЕРЕДИ ДО proc.join(). Обратный порядок — классический
    дедлок multiprocessing.Queue: полезная нагрузка больше буфера pipe
    (~64 КБ), feeder-поток ребёнка блокируется на записи, ребёнок не
    завершается, а родитель вечно висит в join(). Правило из доков
    Python: «все элементы очереди должны быть забраны до join'а».
    Поэтому читаем get() в цикле и join'им только потом.
    """
    import multiprocessing as mp
    from queue import Empty

    ctx = mp.get_context("spawn")
    queue = ctx.Queue()
    proc = ctx.Process(target=_mps_worker,
                       args=(samples, sr, hop, model, batch, queue))
    proc.start()

    # Читаем результат ДО join (см. докстринг). Цикл с секундным таймаутом
    # покрывает все три исхода: результат пришёл; ребёнок погиб, не успев
    # ничего положить (abort Metal-драйвера); зависание — страховочный deadline.
    result = None
    deadline = time.monotonic() + timeout
    while True:
        try:
            result = queue.get(timeout=1.0)
            break
        except Empty:
            if not proc.is_alive():
                break  # ребёнок погиб; если что-то и было — feeder допишет
            if time.monotonic() > deadline:
                break

    proc.join(timeout=10)
    if proc.is_alive():  # параноидально: зомби не оставляем
        proc.kill()
        proc.join(timeout=5)

    if (isinstance(result, tuple) and result and result[0] == "ok"
            and proc.exitcode == 0):
        pitch = np.asarray(result[1], dtype=np.float64)
        conf = np.asarray(result[2], dtype=np.float64)
        return pitch, conf

    sys.stdout.write("\n")  # дочерний бар мог остаться без перевода строки
    if isinstance(result, tuple) and result and result[0] == "err":
        print(f"  ! CREPE на MPS вернул ошибку ({result[1]}), повторяю на CPU")
    else:
        print(f"  ! MPS-процесс не вернул результат (exitcode {proc.exitcode}) — "
              "похоже на abort Metal-драйвера, повторяю на CPU")
    return _crepe_pass(samples, sr, torch.device("cpu"), hop, model, batch)


def estimate_pitch(samples: np.ndarray, sr: int, device: torch.device,
                   hop_ms: float = 8.0, model: str = "full",
                   batch: int | None = None):
    """Прогнать CREPE и вернуть (f0 в Гц, периодичность 0..1, hop в сэмплах)."""
    hop = max(16, int(sr * hop_ms / 1000))
    # batch=None → авто: 256 на MPS / 2048 на CPU. Если драйвер склонен к
    # abort'ам, уменьшайте вручную (флаг --batch: 128, 64, ...).
    if batch is None:
        batch = _MPS_BATCH if device.type == "mps" else 2048
    batch = max(16, int(batch))

    if device.type == "mps":
        pitch, confidence = _run_mps_guarded(samples, sr, hop, model, batch)
    else:
        pitch, confidence = _crepe_pass(samples, sr, device, hop, model, batch)

    # Медианный фильтр (чистый numpy) добивает одиночные октавные скачки
    # декодера — без scipy, чтобы не зависеть от её бинарных расширений.
    confidence = _medfilt1d(confidence, 5)
    return pitch, confidence, hop


def hz_to_cents(pitch_hz: np.ndarray) -> np.ndarray:
    """f0 (Гц) -> центы относительно 10 Гц; неозвученные фреймы = NaN."""
    cents = np.full_like(pitch_hz, np.nan, dtype=np.float64)
    voiced = pitch_hz > 0
    cents[voiced] = 1200.0 * np.log2(pitch_hz[voiced] / _CENTS_REF_HZ)
    return cents


def cents_to_midi(cents: float) -> int:
    """Центы (опора 10 Гц) -> ближайший MIDI-номер: midi = cents/100 + 3.4868."""
    return int(round(cents / 100.0 + 3.4868))
`;

export const CORE_FILES: ProjectFile[] = [
  {
    path: "README.md",
    lang: "markdown",
    group: "Обвязка",
    note: "установка, флаги CLI, устройство пайплайна, диагностика",
    code: readme,
  },
  {
    path: "requirements.txt",
    lang: "ini",
    group: "Обвязка",
    note: "torch / torchaudio / torchcrepe / librosa / mido / PyGuitarPro",
    code: requirements,
  },
  {
    path: "pyproject.toml",
    lang: "ini",
    group: "Обвязка",
    note: "устанавливаемый пакет: pip install -e . и консольная команда bass2tabs",
    code: pyproject,
  },
  {
    path: "bass2tabs/__init__.py",
    lang: "python",
    group: "Обвязка",
    note: "версия пакета",
    code: initPy,
  },
  {
    path: "bass2tabs/__main__.py",
    lang: "python",
    group: "Обвязка",
    note: "точка входа python -m bass2tabs",
    code: mainPy,
  },
  {
    path: "bass2tabs/mps.py",
    lang: "python",
    group: "Ядро",
    note: "выбор устройства (MPS/CUDA/CPU) и диагностика --check",
    code: mpsPy,
  },
  {
    path: "bass2tabs/audio.py",
    lang: "python",
    group: "Ядро",
    note: "загрузка wav/flac/mp3, ресемплинг и фильтрация на MPS",
    code: audioPy,
  },
  {
    path: "bass2tabs/pitch.py",
    lang: "python",
    group: "Ядро",
    note: "CREPE через torchcrepe: инференс на MPS, Витерби, сглаживание",
    code: pitchPy,
  },
];
