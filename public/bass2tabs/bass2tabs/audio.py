"""Загрузка аудио и предобработка на CPU.

Чтение — через soundfile (libsndfile: wav/flac нативно, mp3 на 1.1+),
фолбэк — ffmpeg CLI. НЕ используется torchaudio.load: в torchaudio>=2.6
он игнорирует аргумент backend и требует отдельный пакет torchcodec.

Вся предобработка (миксдаун, ресемплинг, highpass, нормализация) считается
на CPU. Первое выделение GPU-памяти должно происходить только внутри
защищённого дочернего процесса CREPE — иначе Metal-драйвер macOS может
abort'ить процесс на крупных одиночных буферах (IOGPUDeviceShmem).
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torchaudio.functional as F

TARGET_SR = 16000  # CREPE обучен на 16 kHz
_PEAK_DBFS = -1.0


@dataclass
class Clip:
    path: Path
    samples: np.ndarray  # float32, mono, 16 kHz
    sr: int
    source_sr: int

    @property
    def seconds(self) -> float:
        return self.samples.size / self.sr


def _ffmpeg_decode(path: Path) -> tuple[np.ndarray, int]:
    """Декодирование через ffmpeg CLI (для mp3 и всего, что не взял soundfile)."""
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=sample_rate,channels",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    first = probe.stdout.strip().splitlines()[0]
    sr_s, ch_s = first.split(",")[:2]
    sr, channels = int(sr_s), int(ch_s)

    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path),
         "-f", "f32le", "-acodec", "pcm_f32le",
         "-ac", str(channels), "-ar", str(sr), "-"],
        capture_output=True, check=True,
    ).stdout
    data = np.frombuffer(raw, dtype=np.float32).reshape(-1, channels)
    return data, sr


def _read_audio(path: Path) -> tuple[np.ndarray, int]:
    try:
        import soundfile as sf
        data, sr = sf.read(str(path), dtype="float32", always_2d=True)
        return data, int(sr)
    except Exception:
        if shutil.which("ffmpeg") is None:
            raise RuntimeError(
                f"Не удалось прочитать {path.name}: soundfile не справился, "
                "а ffmpeg не найден в PATH. Установите: brew install ffmpeg"
            ) from None
        return _ffmpeg_decode(path)


def load_clip(path: Path) -> Clip:
    """Загрузить файл и привести к mono / 16 kHz float32 (на CPU)."""
    data, source_sr = _read_audio(path)
    wav = torch.from_numpy(np.ascontiguousarray(data.T))  # (channels, N)

    # моно-миксдаун
    if wav.shape[0] > 1:
        wav = wav.mean(dim=0, keepdim=True)
    wav = wav.reshape(-1)

    # ресемплинг до 16 kHz (Kaiser)
    if source_sr != TARGET_SR:
        wav = F.resample(wav, source_sr, TARGET_SR,
                         resampling_method="sinc_interp_kaiser",
                         lowpass_filter_width=64)

    # highpass 30 Гц против сценического гула
    wav = F.highpass_biquad(wav, TARGET_SR, 30.0)

    # нормализация пика до -1 dBFS
    peak = wav.abs().max()
    if peak > 0:
        target = 10 ** (_PEAK_DBFS / 20.0)
        wav = wav * (target / peak)

    return Clip(path=path, samples=wav.numpy().astype(np.float32),
                sr=TARGET_SR, source_sr=source_sr)


def frame_rms(samples: np.ndarray, hop: int, win: int = 1024) -> np.ndarray:
    """RMS-энергия по фреймам (для velocity). Лёгкая операция — на CPU."""
    x = torch.from_numpy(samples)
    frames = x.unfold(0, win, hop) if x.numel() >= win else x.view(1, -1)
    rms = frames.pow(2).mean(dim=1).sqrt()
    return rms.numpy()
