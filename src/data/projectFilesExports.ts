import { CORE_FILES, type ProjectFile } from "./projectFilesCore";

const notesPy = String.raw`"""Питч-контур + онсеты -> список нот: сегментация, центы -> MIDI, velocity, квантизация."""

from __future__ import annotations

from dataclasses import dataclass, field

import librosa
import numpy as np

from .pitch import cents_to_midi

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi_to_name(midi: int) -> str:
    """MIDI-номер -> нотное имя: 28 -> 'E1'."""
    return f"{NOTE_NAMES[midi % 12]}{midi // 12 - 1}"


@dataclass
class Note:
    midi: int
    start: float        # секунды
    duration: float     # секунды
    velocity: int = 96  # 1..127
    start_beat: float | None = None  # в долях (после квантизации)
    beats: float | None = None       # длительность в долях
    _energy: float = field(default=0.0, repr=False)

    @property
    def name(self) -> str:
        return midi_to_name(self.midi)


def estimate_tempo(samples: np.ndarray, sr: int) -> float:
    """Авто-оценка темпа (librosa.beat.beat_track), приведение к 70-170 BPM."""
    tempo, _ = librosa.beat.beat_track(y=samples, sr=sr, units="time")
    t = float(np.atleast_1d(tempo)[0])
    if not np.isfinite(t) or t <= 0:
        return 120.0
    while t < 70.0:
        t *= 2.0
    while t > 170.0:
        t /= 2.0
    return round(t, 1)


def detect_notes(samples: np.ndarray, sr: int, hop: int,
                 cents: np.ndarray, confidence: np.ndarray,
                 rms: np.ndarray, hop_rms: int,
                 confidence_thr: float = 0.5, min_duration: float = 0.08,
                 midi_low: int = 28, midi_high: int = 55) -> list[Note]:
    """Режем контур f0 по онсетам, усредняем каждый сегмент до одной ноты."""
    onsets = librosa.onset.onset_detect(
        y=samples, sr=sr, hop_length=512, backtrack=True, units="time"
    )
    if onsets.size == 0:
        onsets = np.array([0.0])

    bounds = np.append(onsets, samples.shape[0] / sr)
    notes: list[Note] = []

    for t0, t1 in zip(bounds[:-1], bounds[1:]):
        f0 = int(np.floor(t0 * sr / hop))
        f1 = max(f0 + 1, int(np.ceil(t1 * sr / hop)))
        seg_c = cents[f0:f1]
        seg_v = confidence[f0:f1]

        voiced = np.isfinite(seg_c) & (seg_v >= confidence_thr)
        if voiced.sum() < max(3, int(0.4 * voiced.size)):
            continue  # тишина или неразборчивый сегмент

        midi = cents_to_midi(float(np.median(seg_c[voiced])))
        if not (midi_low <= midi <= midi_high):
            continue

        dur = float(t1 - t0)
        if dur < min_duration:
            continue

        i = int(t0 * sr / hop_rms)
        energy = float(rms[i:i + 3].mean()) if rms.size else 0.0
        notes.append(Note(midi=midi, start=float(t0), duration=dur, _energy=energy))

    _assign_velocity(notes)
    return notes


def _assign_velocity(notes: list[Note]) -> None:
    """RMS атаки -> velocity 30..120, линейная нормировка по всему тейку."""
    if not notes:
        return
    e = np.array([n._energy for n in notes])
    lo, hi = float(e.min()), float(e.max())
    for n in notes:
        ratio = 0.5 if hi - lo < 1e-9 else (n._energy - lo) / (hi - lo)
        n.velocity = int(np.clip(round(35 + 85 * ratio), 30, 120))


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
    for a, b in zip(notes, notes[1:]):
        overflow = a.start_beat + a.beats - b.start_beat
        if overflow > 0:
            a.beats = max(step, a.beats - overflow)
    return notes
`;

const exportMidiPy = String.raw`"""Экспорт в Standard MIDI File (mido): 480 tpq, дельта-события, program 34."""

from __future__ import annotations

from pathlib import Path

import mido

TPQ = 480  # тиков в четверти


def write_midi(notes, path: Path, tempo: float = 120.0,
               program: int = 34, title: str = "Bass") -> None:
    mid = mido.MidiFile(ticks_per_beat=TPQ)
    track = mido.MidiTrack()
    mid.tracks.append(track)

    track.append(mido.MetaMessage("track_name", name=title, time=0))
    track.append(mido.MetaMessage("time_signature", numerator=4,
                                  denominator=4, time=0))
    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(tempo), time=0))
    track.append(mido.Message("program_change", program=program,
                              channel=0, time=0))

    events: list[tuple[int, str, int, int]] = []
    for n in notes:
        if n.start_beat is None or n.beats is None:
            continue
        t_on = int(round(n.start_beat * TPQ))
        t_off = t_on + int(round(n.beats * TPQ))
        events.append((t_on, "on", n.midi, n.velocity))
        events.append((t_off, "off", n.midi, 0))

    # при совпадении тиков note_off должен выйти раньше note_on
    events.sort(key=lambda e: (e[0], e[1]))

    last = 0
    for tick, kind, midi, vel in events:
        msg = "note_on" if kind == "on" else "note_off"
        track.append(mido.Message(msg, note=midi, velocity=vel,
                                  channel=0, time=tick - last))
        last = tick

    track.append(mido.MetaMessage("end_of_track", time=0))
    mid.save(path)
`;

const exportXmlPy = String.raw`"""Экспорт в MusicXML (partwise) без сторонних зависимостей.

Басовый ключ, divisions=4 (шестнадцатая = 1), такты 4/4. Ноты,
пересекающие границу такта, разбиваются tie-связками.
"""

from __future__ import annotations

import math
import xml.etree.ElementTree as ET
from pathlib import Path

DIVISIONS = 4                    # четверть = 4 divisions
BAR_UNITS = 16                   # 4/4: шестнадцать шестнадцатых
_TYPE_BY_UNITS = {1: "16th", 2: "eighth", 4: "quarter", 8: "half", 16: "whole"}


def _pitch_tags(midi: int) -> tuple[str, int, int]:
    steps = [("C", 0), ("C", 1), ("D", 0), ("D", 1), ("E", 0), ("F", 0),
             ("F", 1), ("G", 0), ("G", 1), ("A", 0), ("A", 1), ("B", 0)]
    step, alter = steps[midi % 12]
    return step, alter, midi // 12 - 1


def _add_rest(measure, units: int) -> None:
    note = ET.SubElement(measure, "note")
    ET.SubElement(note, "rest")
    ET.SubElement(note, "duration").text = str(units)
    ET.SubElement(note, "voice").text = "1"
    if units in _TYPE_BY_UNITS:
        ET.SubElement(note, "type").text = _TYPE_BY_UNITS[units]


def _add_note(measure, midi: int, units: int, ties: tuple[str, ...] = ()) -> None:
    note = ET.SubElement(measure, "note")
    step, alter, octave = _pitch_tags(midi)
    pitch = ET.SubElement(note, "pitch")
    ET.SubElement(pitch, "step").text = step
    if alter:
        ET.SubElement(pitch, "alter").text = str(alter)
    ET.SubElement(pitch, "octave").text = str(octave)
    ET.SubElement(note, "duration").text = str(units)
    ET.SubElement(note, "voice").text = "1"
    if units in _TYPE_BY_UNITS:
        ET.SubElement(note, "type").text = _TYPE_BY_UNITS[units]
    for t in ties:
        ET.SubElement(note, "tie", type=t)
    if ties:
        notations = ET.SubElement(note, "notations")
        for t in ties:
            ET.SubElement(notations, "tied", type=t)


def write_musicxml(notes, path: Path, tempo: float = 120.0,
                   title: str = "Bass", creator: str = "bass2tabs") -> None:
    root = ET.Element("score-partwise", version="4.0")

    work = ET.SubElement(root, "work")
    ET.SubElement(work, "work-title").text = title
    ident = ET.SubElement(root, "identification")
    ET.SubElement(ident, "creator", type="software").text = creator

    part_list = ET.SubElement(root, "part-list")
    score_part = ET.SubElement(part_list, "score-part", id="P1")
    ET.SubElement(score_part, "part-name").text = "Bass Guitar"
    instr = ET.SubElement(score_part, "score-instrument", id="P1-I1")
    ET.SubElement(instr, "instrument-name").text = "Electric Bass (finger)"
    midi_instr = ET.SubElement(score_part, "midi-instrument", id="P1-I1")
    ET.SubElement(midi_instr, "midi-channel").text = "1"
    ET.SubElement(midi_instr, "midi-program").text = "35"  # в MusicXML program + 1

    # события в целочисленных шестнадцатых
    events = []
    for n in notes:
        if n.start_beat is None or n.beats is None:
            continue
        events.append({
            "start": int(round(n.start_beat * DIVISIONS)),
            "dur": max(1, int(round(n.beats * DIVISIONS))),
            "midi": n.midi,
        })
    events.sort(key=lambda e: e["start"])

    max_u = max((e["start"] + e["dur"] for e in events), default=BAR_UNITS)
    n_bars = max(1, math.ceil(max_u / BAR_UNITS))

    part = ET.SubElement(root, "part", id="P1")
    carry: list[tuple[int, int]] = []  # (midi, остаток в шестнадцатых)

    for bar in range(n_bars):
        measure = ET.SubElement(part, "measure", number=str(bar + 1))
        if bar == 0:
            attributes = ET.SubElement(measure, "attributes")
            ET.SubElement(attributes, "divisions").text = str(DIVISIONS)
            key = ET.SubElement(attributes, "key")
            ET.SubElement(key, "fifths").text = "0"
            time_el = ET.SubElement(attributes, "time")
            ET.SubElement(time_el, "beats").text = "4"
            ET.SubElement(time_el, "beat-type").text = "4"
            clef = ET.SubElement(attributes, "clef")
            ET.SubElement(clef, "sign").text = "F"
            ET.SubElement(clef, "line").text = "4"
            direction = ET.SubElement(measure, "direction", placement="above")
            ET.SubElement(direction, "sound", tempo=str(int(round(tempo))))

        cursor = 0

        # долгие ноты, «перетёкшие» из предыдущего такта
        next_carry: list[tuple[int, int]] = []
        for midi, remaining in carry:
            while remaining > 0 and cursor < BAR_UNITS:
                chunk = min(remaining, BAR_UNITS - cursor)
                remaining -= chunk
                ties = ("stop",) if remaining == 0 else ("stop", "start")
                _add_note(measure, midi, chunk, ties=ties)
                cursor += chunk
            if remaining > 0:
                next_carry.append((midi, remaining))
        carry = next_carry

        for ev in events:
            start_local = ev["start"] - bar * BAR_UNITS
            if not (0 <= start_local < BAR_UNITS):
                continue
            gap = start_local - cursor
            if gap > 0:
                _add_rest(measure, gap)
                cursor += gap
            end = ev["start"] + ev["dur"]
            bar_end = (bar + 1) * BAR_UNITS
            if end <= bar_end:
                _add_note(measure, ev["midi"], ev["dur"])
                cursor += ev["dur"]
            else:  # нота переходит в следующий такт — ставим tie
                first_part = bar_end - ev["start"]
                _add_note(measure, ev["midi"], first_part, ties=("start",))
                cursor += first_part
                carry.append((ev["midi"], end - bar_end))

        if cursor < BAR_UNITS:
            _add_rest(measure, BAR_UNITS - cursor)

    ET.indent(root, space="  ")
    ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)
`;

const exportGp5Py = String.raw`"""Экспорт в Guitar Pro 5 (.gp5) через PyGuitarPro (import guitarpro).

GP хранит ноты как (струна, лад). Строй 4-струнного баса E-A-D-G;
для ноты выбирается минимальный лад (при равенстве — нижняя струна):
позиции остаются читаемыми, в основном 0-5 лады.
"""

from __future__ import annotations

import math
from pathlib import Path

import guitarpro as gp

# номер струны -> MIDI открытой струны; в GP струна 1 — самая высокая
BASS_TUNING = [43, 38, 33, 28]  # G2 D2 A1 E1
BAR_STEPS = 16                  # шестнадцатых в такте 4/4


def _fret_for(midi: int) -> tuple[int, int]:
    """(лад, струна) по эвристике минимального лада."""
    best: tuple[int, int] | None = None
    for idx, open_midi in enumerate(BASS_TUNING):
        fret = midi - open_midi
        if 0 <= fret <= 24:
            string = idx + 1
            if best is None or fret < best[0]:
                best = (fret, string)
    if best is None:
        raise ValueError(f"нота {midi} вне диапазона 4-струнного баса")
    return best


def _duration_value(steps: int) -> int:
    """Снэп к {целая, 1/2, 1/4, 1/8, 1/16}.

    В guitarpro Duration.value — двоичный логарифм от четверти:
    -2 целая, -1 половина, 0 четверть, 1 восьмая, 2 шестнадцатая.
    """
    table = [(16, -2), (8, -1), (4, 0), (2, 1), (1, 2)]
    return min(table, key=lambda t: abs(t[0] - steps))[1]


def _add_rest(voice, steps: int) -> None:
    """Бит без нот записывается как пауза."""
    beat = gp.Beat(voice, duration=gp.Duration(value=_duration_value(steps)))
    voice.beats.append(beat)


def write_gp5(notes, path: Path, tempo: float = 120.0,
              title: str = "Bass", artist: str = "") -> None:
    song = gp.Song()
    song.title = title
    song.artist = artist
    song.tempo = int(round(tempo))

    track = song.tracks[0]
    track.name = "Bass"
    track.strings = [
        gp.GuitarString(number=i + 1, value=v)
        for i, v in enumerate(BASS_TUNING)
    ]
    track.channel.instrument = 34  # Electric Bass (pick)

    max_beat = max((n.start_beat + n.beats for n in notes), default=4.0)
    n_bars = max(1, math.ceil(max_beat / 4.0))
    first = track.measures[0]
    for _ in range(n_bars - 1):
        first.clone(song)

    for bar, measure in enumerate(track.measures):
        voice = measure.voices[0]
        voice.beats.clear()

        events = sorted(
            (n for n in notes if bar * 4 <= n.start_beat < (bar + 1) * 4),
            key=lambda n: n.start_beat,
        )
        cursor = 0  # позиция в шестнадцатых
        for n in events:
            start16 = int(round((n.start_beat - bar * 4) * 4))
            if start16 > cursor:
                _add_rest(voice, start16 - cursor)
            steps = max(1, int(round(n.beats * 4)))
            steps = min(steps, BAR_STEPS - start16)

            beat = gp.Beat(voice, duration=gp.Duration(value=_duration_value(steps)))
            fret, string = _fret_for(n.midi)
            note = gp.Note(beat, string=string, value=n.midi)
            try:
                note.velocity = n.velocity
            except AttributeError:
                pass  # сборка guitarpro без velocity на ноте
            beat.notes.append(note)
            voice.beats.append(beat)
            cursor = start16 + steps

        if cursor < BAR_STEPS:
            _add_rest(voice, BAR_STEPS - cursor)

    gp.write(song, str(path))
`;

const cliPy = String.raw`"""Консольный интерфейс bass2tabs."""

from __future__ import annotations

import os

# ВЫСТАВИТЬ ДО ИМПОРТА TORCH: неподдерживаемые Metal-операции будут
# прозрачно досчитываться на CPU вместо аварийного завершения процесса.
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import argparse
import time
from pathlib import Path

import librosa

from . import __version__
from .audio import load_clip, frame_rms
from .export_gp5 import write_gp5
from .export_midi import write_midi
from .export_xml import write_musicxml
from .mps import check, describe, pick_device
from .notes import detect_notes, estimate_tempo, midi_to_name, quantize
from .pitch import estimate_pitch, hz_to_cents

FORMATS = ("midi", "musicxml", "gp5")
EXT = {"midi": ".mid", "musicxml": ".musicxml", "gp5": ".gp5"}


class C:
    """ANSI-цвета консольного вывода."""
    BOLD = "\033[1m"
    DIM = "\033[2m"
    OK = "\033[92m"
    WARN = "\033[93m"
    END = "\033[0m"


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="bass2tabs",
        description="Транскрибация бас-гитары: wav/flac/mp3 -> MIDI / MusicXML / GP5 (MPS)",
    )
    p.add_argument("input", nargs="?", help="исходный файл (wav/flac/mp3)")
    p.add_argument("-o", "--out", help="каталог вывода (по умолчанию — рядом с файлом)")
    p.add_argument("--formats", default=",".join(FORMATS),
                   help="подмножество midi,musicxml,gp5 через запятую")
    p.add_argument("--device", default="auto", choices=("auto", "mps", "cpu", "cuda"))
    p.add_argument("--hop-ms", type=float, default=8.0,
                   help="шаг питч-трекинга, мс (5-10)")
    p.add_argument("--model", default="full",
                   choices=("full", "tiny"))
    p.add_argument("--batch", type=int, default=0,
                   help="батч CREPE на GPU (0=авто: 256 mps / 2048 cpu); "
                        "уменьшайте, если Metal abort'ится в IOGPUDeviceShmem")
    p.add_argument("--confidence", type=float, default=0.5,
                   help="порог уверенности голосовых фреймов")
    p.add_argument("--min-duration", type=float, default=0.08,
                   help="минимальная длительность ноты, с")
    p.add_argument("--range", default="E1:G4", dest="note_range",
                   help="допустимый диапазон, напр. E1:E4")
    p.add_argument("--grid", type=int, default=16, choices=(4, 8, 16),
                   help="сетка квантизации: делений на целую")
    p.add_argument("--tempo", type=float, default=None,
                   help="фиксированный BPM вместо авто-оценки")
    p.add_argument("--program", type=int, default=34,
                   help="MIDI-программа (33 finger / 34 pick / 35 slap)")
    p.add_argument("--title", default=None, help="название в метаданных")
    p.add_argument("--artist", default=None, help="исполнитель (GP5)")
    p.add_argument("-v", "--verbose", action="store_true",
                   help="печатать каждую ноту")
    p.add_argument("--check", action="store_true",
                   help="диагностика окружения и MPS")
    p.add_argument("--version", action="version",
                   version=f"bass2tabs {__version__}")
    return p


def parse_range(text: str) -> tuple[int, int]:
    lo_s, _, hi_s = text.partition(":")
    lo = librosa.note_to_midi(lo_s.strip())
    hi = librosa.note_to_midi((hi_s or lo_s).strip())
    return min(lo, hi), max(lo, hi)


def fmt_time(seconds: float) -> str:
    m, s = divmod(int(round(seconds)), 60)
    return f"{m}:{s:02d}"


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.check:
        return check()
    if not args.input:
        build_parser().print_help()
        return 2

    t0 = time.perf_counter()
    device = pick_device(args.device)
    print(f"{C.DIM}{describe(device)}{C.END}")

    clip = load_clip(Path(args.input).expanduser(), device)
    print(f"{C.BOLD}· загружено{C.END} {clip.path.name}: "
          f"{fmt_time(clip.seconds)} · {clip.source_sr} Hz -> 16 kHz mono")

    t = time.perf_counter()
    pitch, confidence, hop = estimate_pitch(
        clip.samples, clip.sr, device, hop_ms=args.hop_ms,
        model=args.model, batch=args.batch or None
    )
    cents = hz_to_cents(pitch)
    n_chunks = max(1, -(-clip.samples.size // (30 * clip.sr)))  # чанки по 30 c
    print(f"{C.BOLD}· CREPE-{args.model}{C.END} ({device}): {pitch.size} фреймов, "
          f"{n_chunks} чанк(ов) · hop {args.hop_ms:g} ms · "
          f"{time.perf_counter() - t:.1f} c")

    rms_hop = 512
    rms = frame_rms(clip.samples, rms_hop, device)
    midi_low, midi_high = parse_range(args.note_range)

    notes = detect_notes(
        clip.samples, clip.sr, hop, cents, confidence, rms, rms_hop,
        confidence_thr=args.confidence, min_duration=args.min_duration,
        midi_low=midi_low, midi_high=midi_high,
    )
    tempo = args.tempo or estimate_tempo(clip.samples, clip.sr)
    notes = quantize(notes, tempo, grid=args.grid)
    print(f"{C.BOLD}· сегментация{C.END}: {len(notes)} нот · темп {tempo:g} BPM · "
          f"сетка 1/{args.grid}")

    if not notes:
        print(f"{C.WARN}! уверенных нот не найдено: снизьте --confidence "
              f"или --min-duration{C.END}")
        return 1

    if args.verbose:
        for n in notes:
            print(f"  {n.start_beat:7.2f} | {n.name:>3} | "
                  f"{n.beats:5.2f} долей | vel {n.velocity}")

    out_dir = Path(args.out) if args.out else clip.path.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = clip.path.stem
    title = args.title or stem

    formats = {f.strip().lower() for f in args.formats.split(",") if f.strip()}
    unknown = formats - set(FORMATS)
    if unknown:
        raise SystemExit(f"неизвестные форматы: {', '.join(sorted(unknown))}")

    written = []
    if "midi" in formats:
        path = out_dir / f"{stem}{EXT['midi']}"
        write_midi(notes, path, tempo=tempo, program=args.program, title=title)
        written.append(path)
    if "musicxml" in formats:
        path = out_dir / f"{stem}{EXT['musicxml']}"
        write_musicxml(notes, path, tempo=tempo, title=title, creator="bass2tabs")
        written.append(path)
    if "gp5" in formats:
        path = out_dir / f"{stem}{EXT['gp5']}"
        write_gp5(notes, path, tempo=tempo, title=title, artist=args.artist or "")
        written.append(path)

    lo_name = midi_to_name(min(n.midi for n in notes))
    hi_name = midi_to_name(max(n.midi for n in notes))
    print(f"{C.BOLD}· итог{C.END}: {len(notes)} нот, диапазон {lo_name}-{hi_name}, "
          f"{fmt_time(clip.seconds)} за {time.perf_counter() - t0:.1f} c")
    for path in written:
        size = path.stat().st_size
        print(f"{C.OK}  ok {path}  ({size / 1024:.1f} KB){C.END}")
    return 0
`;

const EXPORT_FILES: ProjectFile[] = [
  {
    path: "bass2tabs/notes.py",
    lang: "python",
    group: "Ядро",
    note: "онсеты → сегменты → ноты, velocity, авто-темп, квантизация",
    code: notesPy,
  },
  {
    path: "bass2tabs/export_midi.py",
    lang: "python",
    group: "Экспорт",
    note: "Standard MIDI File: 480 tpq, дельта-события, program change",
    code: exportMidiPy,
  },
  {
    path: "bass2tabs/export_xml.py",
    lang: "python",
    group: "Экспорт",
    note: "MusicXML partwise: басовый ключ, тай-связки на границах тактов",
    code: exportXmlPy,
  },
  {
    path: "bass2tabs/export_gp5.py",
    lang: "python",
    group: "Экспорт",
    note: "Guitar Pro 5: строй E–A–D–G, табулатура минимальным ладом",
    code: exportGp5Py,
  },
  {
    path: "bass2tabs/cli.py",
    lang: "python",
    group: "Обвязка",
    note: "аргументы, оркестрация пайплайна, цветной вывод, итоги",
    code: cliPy,
  },
];

export const PROJECT_FILES: ProjectFile[] = [...CORE_FILES, ...EXPORT_FILES];
