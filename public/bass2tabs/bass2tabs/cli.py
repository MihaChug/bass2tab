"""Консольный интерфейс bass2tabs."""

from __future__ import annotations

import os

# ВЫСТАВИТЬ ДО ИМПОРТА TORCH: неподдерживаемые Metal-операции будут
# прозрачно досчитываться на CPU вместо аварийного завершения процесса.
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import argparse
import time
from pathlib import Path

from . import __version__
from .audio import load_clip, frame_rms
from .export_gp5 import write_gp5
from .export_midi import write_midi
from .export_xml import write_musicxml
from .mps import check, describe, pick_device
from .notes import detect_notes, estimate_tempo, midi_to_name, quantize
from .pitch import estimate_pitch, hz_to_cents, progress_bar

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
        description="Транскрибация бас-гитары: wav/flac/mp3 -> MIDI / MusicXML / GP5 (MPS)")
    p.add_argument("input", nargs="?", help="файл wav/flac/mp3")
    p.add_argument("-o", "--out", default=None, help="каталог вывода")
    p.add_argument("--formats", default="midi,musicxml,gp5",
                   help="подмножество: midi,musicxml,gp5")
    p.add_argument("--device", default="auto",
                   choices=("auto", "mps", "cuda", "cpu"))
    p.add_argument("--model", default="full",
                   choices=("full", "tiny"), help="ёмкость CREPE")
    p.add_argument("--hop-ms", type=float, default=8.0,
                   help="шаг питч-трекинга, мс (5-10)")
    p.add_argument("--confidence", type=float, default=0.5,
                   help="порог уверенности голосовых фреймов")
    p.add_argument("--min-duration", type=float, default=0.08,
                   help="минимальная длительность ноты, с")
    p.add_argument("--note-range", default="E1:E4",
                   help="рабочий диапазон, например E1:E4")
    p.add_argument("--grid", type=int, default=16,
                   help="сетка квантизации (8 / 16)")
    p.add_argument("--tempo", type=float, default=None,
                   help="темп BPM (по умолчанию — авто)")
    p.add_argument("--batch", type=int, default=None,
                   help="батч CREPE (авто: 64 на MPS / 2048 на CPU)")
    p.add_argument("--program", type=int, default=34,
                   help="MIDI-программа (33 finger / 34 pick / 35 slap)")
    p.add_argument("--title", default=None, help="название в метаданных")
    p.add_argument("--artist", default=None, help="исполнитель (GP5)")
    p.add_argument("-v", "--verbose", action="store_true",
                   help="печатать каждую ноту")
    p.add_argument("--check", action="store_true",
                   help="диагностика окружения")
    p.add_argument("--version", action="version",
                   version=f"bass2tabs {__version__}")
    return p


def fmt_time(seconds: float) -> str:
    m, s = divmod(int(round(seconds)), 60)
    return f"{m}:{s:02d}"


def _name_to_midi(name: str) -> int:
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    name = name.strip()
    letter = name[0].upper()
    rest = name[1:]
    acc = 0
    if rest.startswith("#"):
        acc, rest = 1, rest[1:]
    elif rest.startswith("b"):
        acc, rest = -1, rest[1:]
    octave = int(rest) if rest else 1
    return 12 * (octave + 1) + names[letter] + acc


def parse_range(spec: str) -> tuple[int, int]:
    try:
        lo_s, hi_s = spec.split(":")
        return _name_to_midi(lo_s), _name_to_midi(hi_s)
    except Exception:
        return 28, 64


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

    clip = load_clip(Path(args.input).expanduser())
    print(f"{C.BOLD}· загружено{C.END} {clip.path.name}: "
          f"{fmt_time(clip.seconds)} · {clip.source_sr} Hz -> 16 kHz mono")

    print(f"{C.BOLD}· питч-трекинг (CREPE {args.model} на {device.type})…{C.END}")
    t = time.perf_counter()
    pitch, confidence, hop = estimate_pitch(
        clip.samples, clip.sr, device, hop_ms=args.hop_ms,
        model=args.model, batch=args.batch or None)
    cents = hz_to_cents(pitch)
    print(f"{C.BOLD}· CREPE-{args.model}{C.END} ({device.type}): {pitch.size} фреймов, "
          f"hop {args.hop_ms:g} ms · {time.perf_counter() - t:.1f} c")

    print(f"{C.BOLD}· онсеты, темп и сегментация…{C.END}")
    rms_hop = 512
    rms = frame_rms(clip.samples, rms_hop)
    midi_low, midi_high = parse_range(args.note_range)

    notes = detect_notes(
        clip.samples, clip.sr, hop, cents, confidence, rms, rms_hop,
        confidence_thr=args.confidence, min_duration=args.min_duration,
        midi_low=midi_low, midi_high=midi_high)
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

    order = [f for f in FORMATS if f in formats]
    print(f"{C.BOLD}· экспорт ({', '.join(order)})…{C.END}")
    written = []
    for i, fmt in enumerate(order):
        if fmt == "midi":
            path = out_dir / f"{stem}{EXT['midi']}"
            write_midi(notes, path, tempo=tempo, program=args.program, title=title)
        elif fmt == "musicxml":
            path = out_dir / f"{stem}{EXT['musicxml']}"
            write_musicxml(notes, path, tempo=tempo, title=title, creator="bass2tabs")
        else:
            path = out_dir / f"{stem}{EXT['gp5']}"
            write_gp5(notes, path, tempo=tempo, title=title,
                      artist=args.artist or "")
        written.append(path)
        progress_bar(i + 1, len(order), f"экспорт · {fmt}")

    lo_name = midi_to_name(min(n.midi for n in notes))
    hi_name = midi_to_name(max(n.midi for n in notes))
    print(f"{C.BOLD}· итог{C.END}: {len(notes)} нот, диапазон {lo_name}-{hi_name}, "
          f"{fmt_time(clip.seconds)} за {time.perf_counter() - t0:.1f} c")
    for path in written:
        size = path.stat().st_size
        print(f"{C.OK}  ok {path}  ({size / 1024:.1f} KB){C.END}")
    return 0
