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

- загрузка wav / flac / mp3 через torchaudio (soundfile → ffmpeg fallback);
- предобработка на MPS: моно-миксдаун, ресемплинг до 16 kHz, highpass 30 Гц,
  нормализация пика до −1 dBFS;
- питч-трекинг CREPE (full) через torchcrepe, декодирование Витерби,
  медианная фильтрация контура;
- детекция онсетов (librosa) → сегментация контура → привязка к ближайшему
  полутону в центовом пространстве, диапазон E1–G4 (настраивается);
- velocity из RMS-энергии атаки, авто-оценка темпа (beat_track) или --tempo;
- квантизация на сетку 1/16 (или 1/8, 1/4);
- экспорт: .mid (mido), .musicxml (собственный writer, басовый ключ, связи),
  .gp5 (guitarpro, 4-струнный строй E–A–D–G, эвристика минимального лада).

## Требования

- macOS 12.3+ на Apple Silicon (M1/M2/M3/M4), Python 3.10+;
- ffmpeg (для mp3): brew install ffmpeg;
- torch >= 2.1 arm64-сборка — MPS включится автоматически.

## Установка

    brew install ffmpeg
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    python -m bass2tabs --check        # диагностика MPS

## Быстрый старт

    python -m bass2tabs take.wav -o out --formats midi,musicxml,gp5
    python -m bass2tabs slap.flac --device mps --model full --grid 16 --tempo 112
    python -m bass2tabs demo.mp3 --range E1:E4 --min-duration 0.06 -v

## Флаги CLI

| флаг             | по умолчанию | смысл                                            |
|------------------|--------------|--------------------------------------------------|
| --formats        | все три      | подмножество midi, musicxml, gp5                 |
| --device         | auto         | auto / mps / cpu / cuda                          |
| --hop-ms         | 8            | шаг питч-трекинга, мс (5–10)                     |
| --model          | full         | ёмкость CREPE: full / tiny                       |
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

1. torchaudio грузит файл и пересылает моно-сигнал 16 kHz на MPS;
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
   ключом и tie-связками на границах тактов; GP5 — через guitarpro,
   нота маппится в (струна, лад) минимальным ладом.

## Диагностика

- MPS недоступен → macOS < 12.3 или x86-сборка torch (проверьте file
  $(python -c "import torch; print(torch.__file__)"));
- ноты «дробятся» → поднимите --min-duration или --confidence;
- гудящие призраки на паузах → CREPE уверен на тишине редко: поднимите
  --confidence до 0.6–0.7;
- pip: «No matching distribution found for torch-mel-crepe» → пакета с
  таким именем в PyPI нет, он называется torchcrepe (одно слово, без
  дефисов). В requirements.txt это уже учтено:
  pip install "torchcrepe>=0.0.22".

## Лицензия

MIT. Зависимости: torch, torchaudio, torchcrepe, librosa, scipy,
numpy, mido, guitarpro.
`;

const requirements = String.raw`# bass2tabs — зависимости
# torch/torchaudio: arm64-сборки для Apple Silicon (MPS)
torch>=2.1
torchaudio>=2.1

# питч-трекинг CREPE на чистом torch (инференс идёт на MPS)
# ВАЖНО: пакет в PyPI называется torchcrepe — одним словом, без дефисов.
# (torch-mel-crepe не существует: pip отдаст "No matching distribution found")
torchcrepe>=0.0.22,<0.1

# DSP: онсеты, темп, медианные фильтры
librosa>=0.10
scipy>=1.11
numpy>=1.24,<2.1

# экспорт
mido>=1.3            # Standard MIDI File
guitarpro>=0.6       # чтение/запись Guitar Pro 3–5 (.gp5)
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
        import torchcrepe
        print(f"  torchcrepe       {torchcrepe.__version__}")
    except ImportError:
        print('  torchcrepe       не установлен: pip install "torchcrepe>=0.0.22"')
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

const audioPy = String.raw`"""Загрузка и предобработка аудио целиком в torch (на MPS, когда доступен).

torchaudio читает wav/flac нативно (libsndfile), mp3 — через soundfile
(>= 0.13 умеет mp3) либо ffmpeg-бэкенд. Ресемплинг и фильтрация считаются
на GPU, в numpy сигнал уходит только перед librosa/CREPE.
"""

from __future__ import annotations

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


def load_clip(path: Path, device: torch.device) -> AudioClip:
    """Загрузить файл, смикшировать в моно и ресемплировать до 16 kHz."""
    if not path.exists():
        raise FileNotFoundError(f"файл не найден: {path}")

    try:
        wav, sr = torchaudio.load(path, backend="soundfile")
    except Exception:
        wav, sr = torchaudio.load(path, backend="ffmpeg")  # mp3 и прочее

    wav = wav.to(device=device, dtype=torch.float32)
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
    samples = wav.squeeze(0).clamp(-1.0, 1.0).cpu().numpy().astype(np.float32)
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


def frame_rms(samples: np.ndarray, hop: int, device: torch.device,
              win: int = 1024) -> np.ndarray:
    """RMS-энергия по фреймам (для velocity). Считается на MPS одним тензором."""
    x = torch.from_numpy(samples).to(device)
    frames = x.unfold(0, win, hop) if x.numel() >= win else x.view(1, -1)
    rms = frames.pow(2).mean(dim=1).sqrt()
    return rms.cpu().numpy()
`;

const pitchPy = String.raw`"""Питч-трекинг CREPE (чистый PyTorch, пакет torchcrepe) — инференс на MPS.

CREPE — монофонический детектор высоты: CNN поверх сырой волны выдаёт
распределение по 360 центовым бинам (по 20 центов, опора 10 Гц).
torchcrepe — канонический PyTorch-порт модели из PyPI, поэтому инференс
честно уходит на MPS через параметр device; при сбое Metal-операций
прогон прозрачно повторяется на CPU.

Установка: pip install "torchcrepe>=0.0.22"
Пакет называется torchcrepe — одним словом. Имени torch-mel-crepe в PyPI
не существует (отсюда ошибка pip "No matching distribution found").
"""

from __future__ import annotations

import numpy as np
import torch
from scipy.signal import medfilt

try:
    import torchcrepe
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        'Не найден torchcrepe. Выполните: pip install "torchcrepe>=0.0.22"'
    ) from exc

# Рабочий диапазон 4-струнного баса с запасом на слэп-обертоны.
BASS_FMIN_HZ = 41.2    # E1 — открытая четвёртая струна
BASS_FMAX_HZ = 392.0   # G4 — верх типичного басового диапазона

# CREPE измеряет высоту в центах относительно 10 Гц:
# cents = 1200 * log2(f / 10)
_CENTS_REF_HZ = 10.0


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


def estimate_pitch(samples: np.ndarray, sr: int, device: torch.device,
                   hop_ms: float = 8.0, model: str = "full"):
    """Прогнать CREPE и вернуть (f0 в Гц, периодичность 0..1, hop в сэмплах)."""
    hop = max(16, int(sr * hop_ms / 1000))
    batch = 1024 if device.type == "mps" else 2048
    audio = torch.as_tensor(samples, dtype=torch.float32).reshape(1, -1)

    try:
        pitch, confidence = _predict(audio, sr, hop, model, device, batch)
    except RuntimeError as exc:
        # Редкие операции CREPE могут быть не заведены на Metal —
        # тогда повторяем на CPU и честно об этом говорим.
        if device.type != "mps":
            raise
        print(f"  ! MPS-инференс упал ({type(exc).__name__}), повторяю на CPU")
        pitch, confidence = _predict(
            audio, sr, hop, model, torch.device("cpu"), batch
        )

    pitch = pitch.detach().float().cpu().numpy().reshape(-1).astype(np.float64)
    confidence = (
        confidence.detach().float().cpu().numpy().reshape(-1).astype(np.float64)
    )

    # Медианный фильтр добивает одиночные октавные скачки декодера.
    confidence = medfilt(confidence, kernel_size=5)
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
    note: "torch / torchaudio / torchcrepe / librosa / mido / guitarpro",
    code: requirements,
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
