"""Сегментация питч-контура в ноты: онсеты, медиана центов, velocity, темп."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


@dataclass
class Note:
    start: float          # секунды
    duration: float       # секунды
    midi: int
    velocity: int = 90
    start_beat: float | None = None  # заполняется в quantize
    beats: float | None = None       # длительность в долях

    @property
    def name(self) -> str:
        return f"{NOTE_NAMES[self.midi % 12]}{self.midi // 12 - 1}"


def midi_to_name(midi: int) -> str:
    return f"{NOTE_NAMES[midi % 12]}{midi // 12 - 1}"


def cents_to_midi(cents: float) -> int:
    """Центы CREPE (опора 10 Гц) -> ближайший MIDI-номер: midi = cents/100 + 3.4868."""
    return int(round(cents / 100.0 + 3.4868))


def detect_notes(samples, sr, hop, cents, confidence, rms, rms_hop,
                 confidence_thr=0.5, min_duration=0.08,
                 midi_low=28, midi_high=64) -> list[Note]:
    """Онсеты -> сегменты -> ноты.

    Высота — медиана центов по «озвученным» фреймам сегмента (устойчива к
    вибрато). Velocity — из RMS первых фреймов атаки, нормируется на 30-120.
    """
    import librosa

    onset_frames = librosa.onset.onset_detect(
        y=samples, sr=sr, backtrack=True, units="frames", hop_length=hop)
    onsets = sorted({int(f) for f in onset_frames})
    if not onsets:
        onsets = [0]

    times = np.arange(len(cents)) * (hop / sr)
    notes: list[Note] = []
    for i, start_f in enumerate(onsets):
        end_f = onsets[i + 1] if i + 1 < len(onsets) else len(cents)
        seg_c = cents[start_f:end_f]
        seg_conf = confidence[start_f:end_f]
        voiced = np.isfinite(seg_c) & (seg_conf >= confidence_thr)
        if not voiced.any():
            continue
        midi = cents_to_midi(float(np.median(seg_c[voiced])))
        if not (midi_low <= midi <= midi_high):
            continue

        start = times[start_f]
        end = times[min(end_f, len(times) - 1)]
        dur = max(end - start, hop / sr)
        if dur < min_duration:
            continue

        # velocity из RMS первых фреймов после атаки
        r0 = start_f * hop // rms_hop
        seg_rms = rms[r0:r0 + 3]
        vel = float(np.mean(seg_rms)) if seg_rms.size else 0.0
        notes.append(Note(start=float(start), duration=float(dur),
                          midi=int(midi), velocity=vel))

    if not notes:
        return []
    peak = max(n.velocity for n in notes) or 1.0
    for n in notes:
        n.velocity = max(30, min(120, int(30 + 90 * (n.velocity / peak))))
    return notes


def estimate_tempo(samples, sr) -> float:
    """Авто-темп по beat_track, приведённый к диапазону 70-170 BPM."""
    import librosa
    tempo, _ = librosa.beat.beat_track(y=samples, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])
    while bpm < 70:
        bpm *= 2
    while bpm > 170:
        bpm /= 2
    return round(bpm, 1)


def quantize(notes: list[Note], tempo: float, grid: int = 16) -> list[Note]:
    """Снэп стартов и длительностей к сетке; grid = делений на целую ноту."""
    if not notes:
        return notes
    spb = 60.0 / tempo          # секунд в доле
    step = 4.0 / grid           # в долях: 16 -> 0.25 (шестнадцатая)

    for n in notes:
        n.start_beat = max(0.0, round(n.start / spb / step) * step)
        n.beats = max(step, round(n.duration / spb / step) * step)

    notes.sort(key=lambda n: (n.start_beat, n.midi))
    # соседние ноты не должны накладываться — укорачиваем хвост предыдущей
    for a, b in zip(notes, notes[1:]):
        overflow = a.start_beat + a.beats - b.start_beat
        if overflow > 0:
            a.beats = max(step, a.beats - overflow)
    return notes
