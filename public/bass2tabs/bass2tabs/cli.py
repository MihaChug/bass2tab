"""Консольный интерфейс bass2tabs."""

from __future__ import annotations

import os

# ВЫСТАВИТЬ ДО ИМПОРТА TORCH: неподдерживаемые Metal-операции будут
# прозрачно досчитываться на CPU вместо аварийного завершения процесса.
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import argparse
import sys
import time
from pathlib import Path

from .audio import load_clip, frame_rms
from .mps import pick_device, describe, check
from .notes import detect_notes, estimate_tempo, midi_to_name, quantize
from .pitch import estimate_pitch, progress_bar
from .export_midi import write_midi
from .export_xml import write_musicxml
from .export_gp5 import write_gp5


class C:  # цвета терминала
    BOLD = "\033[1m"
    DIM = "\033[2m"
    OK = "\033[32m"
    WARN = "\033[33m"
    ERR = "\033[31m"
    AMBER = "\033[38;5;214m"
    END = "\033[0m"


# Поддерживаемые входные расширения.
AUDIO_EXTS = {".wav", ".flac", ".mp3"}


def collect_inputs(src: Path, recursive: bool) -> list[Path]:
    """Вернуть список файлов к обработке.

    Если ``src`` — файл, возвращаем его один. Если каталог — все файлы с
    поддерживаемыми расширениями (отсортированные по имени), рекурсивно при
    ``recursive=True``. Пустой/несуществующий каталог даёт пустой список.
    """
    src = src.expanduser()
    if src.is_file():
        return [src]
    if not src.is_dir():
        return []
    pattern = "**/*" if recursive else "*"
    files = [f for f in src.glob(pattern)
             if f.is_file() and f.suffix.lower() in AUDIO_EXTS]
    return sorted(files, key=lambda f: f.name.lower())


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="bass2tabs",
        description="Транскрибация бас-гитары: wav/flac/mp3 -> MIDI / MusicXML / GP5")
    p.add_argument("input",
                   help="путь к аудиофайлу (wav/flac/mp3) ИЛИ к папке с файлами — "
                        "тогда будут обработаны все поддерживаемые файлы в ней")
    p.add_argument("-o", "--out", default="out", help="каталог вывода")
    p.add_argument("-r", "--recursive", action="store_true",
                   help="для папки: искать аудиофайлы и во вложенных каталогах")
    p.add_argument("--formats", default="midi,musicxml,gp5",
                   help="список форматов через запятую")
    p.add_argument("--device", default="auto",
                   choices=("auto", "mps", "cuda", "cpu"))
    p.add_argument("--model", default="full", choices=("full", "tiny"),
                   help="ёмкость CREPE (веса, которые публикует torchcrepe)")
    p.add_argument("--hop-ms", type=float, default=8.0,
                   help="шаг фреймов CREPE в мс")
    p.add_argument("--batch", type=int, default=0,
                   help="батч инференса (0 -> авто: 64 mps / 2048 cpu)")
    p.add_argument("--on-thr", type=float, default=0.60,
                   help="порог АКТИВАЦИИ ноты (гистерезис, вкл)")
    p.add_argument("--off-thr", type=float, default=0.35,
                   help="порог СБРОСА ноты (гистерезис, выкл)")
    p.add_argument("--highpass", type=float, default=32.0,
                   help="срез high-pass в Гц (30-35; 0 = выключить)")
    p.add_argument("--confidence", type=float, default=None,
                   help="(устар.) = --on-thr")
    p.add_argument("--min-duration", type=float, default=0.08,
                   help="минимальная длительность ноты, c")
    p.add_argument("--tempo", type=float, default=None,
                   help="фиксированный BPM (по умолчанию — авто)")
    p.add_argument("--grid", type=int, default=16,
                   help="сетка квантизации: делений на целую ноту")
    p.add_argument("--program", type=int, default=34,
                   help="MIDI-программа (33 finger / 34 pick / 35 slap)")
    p.add_argument("--title", default=None, help="название в метаданных")
    p.add_argument("--artist", default=None, help="исполнитель (GP5)")
    p.add_argument("-v", "--verbose", action="store_true",
                   help="печатать каждую ноту")
    p.add_argument("--check", action="store_true",
                   help="диагностика окружения и выход")
    return p


def process_one(path: Path, args, device, tag: str = "") -> dict:
    """Полный конвейер для одного файла: загрузка -> CREPE -> ноты -> экспорт.

    Возвращает отчёт: {"file", "written", "notes", "dur", "elapsed", "error"}.
    Ошибка в одном файле не прерывает пакет — она фиксируется в "error".
    """
    t0 = time.perf_counter()
    rep = {"file": path.name, "written": [], "notes": 0,
           "dur": 0.0, "elapsed": 0.0, "error": None}
    try:
        clip = load_clip(path, highpass_hz=args.highpass)
        rep["dur"] = clip.duration
        hp = f" · high-pass {args.highpass:g} Гц" if args.highpass > 0 else ""
        print(f"{C.BOLD}{tag}· загружено {clip.path.name}{C.END}: "
              f"{int(clip.duration // 60)}:{int(clip.duration % 60):02d} · "
              f"{clip.src_sr} Hz -> {clip.sr // 1000} kHz mono{hp}")

        print(f"{C.AMBER}{tag}· питч-трекинг (CREPE {args.model} на {device.type})…"
              f"{C.END}")
        cents, confidence, hop = estimate_pitch(
            clip.samples, clip.sr, device, model=args.model,
            hop_ms=args.hop_ms, batch=args.batch)
        n_chunks = max(1, -(-clip.samples.numel() // (30 * clip.sr)))
        print(f"{C.BOLD}{tag}· CREPE-{args.model}{C.END} ({device.type}): "
              f"{cents.size} фреймов, {n_chunks} чанк(ов) · hop {args.hop_ms:g} ms · "
              f"{time.perf_counter() - t0:.1f} c")

        print(f"{C.AMBER}{tag}· онсеты, темп и сегментация (гистерезис "
              f"{args.on_thr:g}/{args.off_thr:g})…{C.END}")
        rms_hop = max(1, hop)
        rms = frame_rms(clip.samples, rms_hop)
        on_thr = args.on_thr if args.confidence is None else args.confidence
        notes = detect_notes(clip.samples, clip.sr, hop, cents, confidence,
                             rms, rms_hop, on_thr=on_thr, off_thr=args.off_thr,
                             min_duration=args.min_duration)
        tempo = args.tempo or estimate_tempo(clip.samples, clip.sr)
        notes = quantize(notes, tempo, grid=args.grid)
        print(f"{C.BOLD}{tag}· сегментация{C.END}: {len(notes)} нот · "
              f"темп {tempo:g} BPM · сетка 1/{args.grid}")

        if not notes:
            rep["error"] = "Нот не найдено — понизьте --on-thr (например, до 0.4)."
            print(f"{C.WARN}{tag}Нот не найдено — понизьте --on-thr "
                  f"(например, до 0.4).{C.END}")
            return rep

        rep["notes"] = len(notes)
        if args.verbose:
            for n in notes:
                print(f"    {C.DIM}{n.start:7.2f}s{C.END} {midi_to_name(n.midi):<3} "
                      f"{C.DIM}vel {n.velocity}{C.END}")

        out_dir = Path(args.out).expanduser()
        out_dir.mkdir(parents=True, exist_ok=True)
        stem = clip.path.stem
        title = args.title or stem

        formats = {f.strip().lower() for f in args.formats.split(",") if f.strip()}
        order = [f for f in ("midi", "musicxml", "gp5") if f in formats]
        print(f"{C.AMBER}{tag}· экспорт ({', '.join(order)})…{C.END}")
        for i, fmt in enumerate(order):
            out_path = out_dir / f"{stem}.{'mid' if fmt == 'midi' else fmt}"
            if fmt == "midi":
                write_midi(notes, out_path, tempo=tempo,
                           program=args.program, title=title)
            elif fmt == "musicxml":
                write_musicxml(notes, out_path, tempo=tempo,
                               title=title, creator="bass2tabs")
            else:
                write_gp5(notes, out_path, tempo=tempo, title=title,
                          artist=args.artist or "")
            rep["written"].append(out_path)
            progress_bar(i + 1, len(order), f"экспорт · {fmt}")

        total = time.perf_counter() - t0
        print(f"\n{C.OK}{C.BOLD}{tag}· итог{C.END}: {len(notes)} нот · "
              f"{int(clip.duration // 60)}:{int(clip.duration % 60):02d} "
              f"за {total:.1f} c")
        for p in rep["written"]:
            size = p.stat().st_size
            print(f"  {C.OK}ok {p}{C.END}  ({size / 1024:.1f} KB)")
    except Exception as exc:  # один битый файл не должен валить весь пакет
        rep["error"] = f"{type(exc).__name__}: {exc}"
        print(f"{C.ERR}{tag}Ошибка на {path.name}: {rep['error']}{C.END}")
    rep["elapsed"] = time.perf_counter() - t0
    return rep


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)

    if args.check:
        return check()

    device = pick_device(args.device)
    print(describe(device))

    inputs = collect_inputs(Path(args.input), args.recursive)
    if not inputs:
        print(f"{C.ERR}Не найдено аудиофайлов ({', '.join(sorted(AUDIO_EXTS))}) "
              f"в «{args.input}».{C.END}")
        return 1

    batch = len(inputs) > 1
    if batch:
        print(f"\n{C.AMBER}{C.BOLD}▸ пакет: {len(inputs)} файл(ов){C.END}"
              f"{C.DIM} из {Path(args.input).expanduser()}{C.END}")

    t_all = time.perf_counter()
    reports = []
    for i, path in enumerate(inputs, start=1):
        if batch:
            print(f"\n{C.BOLD}{C.AMBER}[{i}/{len(inputs)}]{C.END} {C.DIM}{path}{C.END}")
            tag = "  "
        else:
            tag = ""
        reports.append(process_one(path, args, device, tag=tag))

    if batch:
        ok = [r for r in reports if not r["error"]]
        fail = [r for r in reports if r["error"]]
        notes_all = sum(r["notes"] for r in reports)
        dur_all = sum(r["dur"] for r in reports)
        print(f"\n{C.BOLD}{'═' * 52}{C.END}")
        print(f"{C.OK}{C.BOLD}· пакет готов{C.END}: {len(ok)}/{len(reports)} файлов · "
              f"{notes_all} нот · {int(dur_all // 60)}:{int(dur_all % 60):02d} аудио · "
              f"{time.perf_counter() - t_all:.1f} c")
        for r in fail:
            print(f"  {C.ERR}!! {r['file']}{C.END} — {r['error']}")
        return 0 if not fail else 1

    return 0 if not reports[0]["error"] else 1


if __name__ == "__main__":
    sys.exit(main())
