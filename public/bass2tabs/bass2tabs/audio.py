"""Чтение wav/flac/mp3 и предобработка на CPU.

Чтение — soundfile (libsndfile), фолбэк — ffmpeg CLI. Не используется
torchaudio.load, поэтому torchcodec не нужен. DSP (моно-миксдаун,
ресемплинг до 16 kHz, high-pass 30-35 Гц, нормализация пика) считается на
CPU через torchaudio.functional — от бэкендов ввода-вывода он не зависит.

HIGH-PASS перед CREPE: срез ~32 Гц убирает сценический гул, рокот и
постоянную составляющую, поднимая уверенность нейросети в полезных фреймах
(периодичность ниже E1≈41 Гц басу в стандартном строе не нужна).
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torchaudio.functional as AF

TARGET_SR = 16000        # CREPE обучен на 16 kHz
HIGHPASS_HZ = 32.0       # срез high-pass в диапазоне 30-35 Гц


@dataclass
class Clip:
    path: Path
    samples: torch.Tensor   # float32 [N], моно, 16 kHz, CPU
    sr: int
    src_sr: int
    duration: float


def _read_audio(path: Path) -> tuple[np.ndarray, int]:
    """Вернуть (float32 [ch, N], sr). wav/flac — soundfile, прочее — ffmpeg."""
    import soundfile as sf
    try:
        data, sr = sf.read(str(path), dtype="float32", always_2d=True)
        return data.T, int(sr)
    except Exception:
        pass

    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            f"soundfile не смог прочитать {path.name}, а ffmpeg не найден. "
            "Для mp3/m4a установите ffmpeg: brew install ffmpeg"
        )
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=sample_rate,channels",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True).stdout.strip()
    sr_str, ch_str = probe.split(",")[:2]
    sr, ch = int(sr_str), int(ch_str)

    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path),
         "-f", "f32le", "-acodec", "pcm_f32le", "-"],
        capture_output=True, check=True).stdout
    arr = np.frombuffer(raw, dtype="<f4").reshape(-1, ch).T.copy()
    return arr, sr


def load_clip(path: Path, highpass_hz: float = HIGHPASS_HZ) -> Clip:
    """Загрузить файл, привести к моно 16 kHz, high-pass, нормализовать."""
    arr, src_sr = _read_audio(path)
    x = torch.from_numpy(np.ascontiguousarray(arr, dtype=np.float32))

    if x.ndim == 1:
        x = x.unsqueeze(0)
    if x.size(0) > 1:
        x = x.mean(dim=0, keepdim=True)          # миксдаун в моно

    if src_sr != TARGET_SR:
        x = AF.resample(x, src_sr, TARGET_SR,
                        resampling_method="sinc_interp_kaiser", beta=14.76)

    if highpass_hz > 0:
        # Биквад-фильтр Баттерворта (Q=0.707) — мягкий срез без звона.
        x = AF.highpass_biquad(x, TARGET_SR, cutoff_freq=float(highpass_hz), Q=0.707)

    peak = x.abs().max()
    if peak > 0:
        x = x * (10 ** (-1.0 / 20.0) / peak)     # пик -> -1 dBFS

    mono = x.squeeze(0).contiguous()
    return Clip(path=path, samples=mono, sr=TARGET_SR, src_sr=src_sr,
                duration=mono.numel() / TARGET_SR)


def frame_rms(samples: torch.Tensor, hop: int) -> np.ndarray:
    """Скользящий RMS по окнам hop — основа для velocity."""
    n = samples.numel()
    if n == 0:
        return np.zeros(0, dtype=np.float64)
    pad = hop - (n % hop) if n % hop else 0
    x = torch.nn.functional.pad(samples, (0, pad))
    frames = x.reshape(-1, hop)
    return frames.pow(2).mean(dim=1).sqrt().double().numpy()
