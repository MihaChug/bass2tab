"""Сегментация питч-контура в ноты.

Ключевая идея — ДВУХПОРОГОВАЯ (гистерезисная) система вместо одного жёсткого
порога:
  * порог АКТИВАЦИИ ноты  on_thr  = 0.60 — нота начинается, только когда
    уверенность CREPE уверенно высокая (не ловим случайные касания струн);
  * порог СБРОСА ноты     off_thr = 0.35 — нота «держится», пока уверенность
    не упадёт совсем низко: затухающий хвост не обрывается раньше времени.

Грубые «звучащие» сегменты от гистерезиса затем режутся онсетами librosa,
чтобы повторные атаки той же высоты не сливались в одну длинную ноту.
"""

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


def hysteresis_segments(confidence: np.ndarray,
                        on_thr: float = 0.6, off_thr: float = 0.35,
                        min_frames: int = 3) -> list[tuple[int, int]]:
    """Двухпороговая сегментация озвученных кадров (триггер Шмитта).

    Кадр «включает» ноту при confidence >= on_thr и «выключает» её, только
    когда confidence < off_thr. Интервал [off_thr, on_thr) — зона удержания:
    затухающая нота продолжается, пока не упадёт ниже порога сброса.

    Возвращает список (start, end) индексов кадров, end не включается.
    """
    segments: list[tuple[int, int]] = []
    in_note = False
    start = 0
    for i, c in enumerate(confidence):
        c = float(c) if np.isfinite(c) else 0.0
        if not in_note:
            if c >= on_thr:
                in_note = True
                start = i
        elif c < off_thr:
            segments.append((start, i))
            in_note = False
    if in_note:
        segments.append((start, len(confidence)))
    return [(s, e) for s, e in segments if e - s >= min_frames]


def detect_notes(samples, sr, hop, cents, confidence, rms, rms_hop,
                 on_thr=0.6, off_thr=0.35, min_duration=0.08,
                 midi_low=28, midi_high=64) -> list[Note]:
    """Гистерезис -> звучащие сегменты; онсеты -> разрезание; медиана -> нота.

    Высота — медиана центов по кадрам с confidence >= off_thr внутри сегмента
    (устойчива к вибрато и захватывает затухающий хвост). Velocity — из RMS
    первых кадров атаки, нормируется на 30-120.
    """
    import librosa

    times = np.arange(len(cents)) * (hop / sr)

    # 1) грубые «звучащие» сегменты — двухпороговая гистерезис-сегментация
    sounding = hysteresis_segments(confidence, on_thr=on_thr, off_thr=off_thr)
    if not sounding:
        return []

    # 2) атаки во всём треке — чтобы разрезать залипшие повторные ноты
    onset_frames = librosa.onset.onset_detect(
        y=samples, sr=sr, backtrack=True, units="frames", hop_length=hop)
    onsets = sorted({int(f) for f in onset_frames})

    # 3) каждый звучащий сегмент режем онсетами -> отдельные ноты
    notes: list[Note] = []
    for s, e in sounding:
        cuts = [o for o in onsets if s < o < e]
        bounds = [s] + cuts + [e]
        for a, b in zip(bounds, bounds[1:]):
            seg_c = cents[a:b]
            seg_conf = confidence[a:b]
            voiced = np.isfinite(seg_c) & (seg_conf >= off_thr)
            if not voiced.any():
                continue
            midi = cents_to_midi(float(np.median(seg_c[voiced])))
            if not (midi_low <= midi <= midi_high):
                continue

            start = times[a]
            end = times[min(b, len(times) - 1)]
            dur = max(end - start, hop / sr)
            if dur < min_duration:
                continue

            r0 = a * hop // rms_hop
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
