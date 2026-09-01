"""Экспорт в MusicXML (partwise) без сторонних зависимостей.

MusicXML — это XML в UTF-8, поэтому кириллица в названии сохраняется как
есть (to_latin1 здесь НЕ нужен). Басовый ключ (F, линейка 4),
divisions=4 (шестнадцатая = 1). Ноты, пересекающие границу такта,
разбиваются с tie-связками.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

STEPS = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"]
ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0]

DIVISIONS = 4                    # divisions на четверть -> шестнадцатая = 1
BEATS_PER_BAR = 4                # размер 4/4
BAR_DIVS = DIVISIONS * BEATS_PER_BAR  # 16 шестнадцатых в такте


def _add_note(parent, midi, dur_divs, tie_start=False, tie_stop=False):
    """Добавить <note>; midi=None — пауза."""
    note = ET.SubElement(parent, "note")
    if midi is None:
        ET.SubElement(note, "rest")
    else:
        pitch = ET.SubElement(note, "pitch")
        ET.SubElement(pitch, "step").text = STEPS[midi % 12]
        if ALTERS[midi % 12]:
            ET.SubElement(pitch, "alter").text = str(ALTERS[midi % 12])
        ET.SubElement(pitch, "octave").text = str(midi // 12 - 1)
    ET.SubElement(note, "duration").text = str(max(1, int(dur_divs)))
    if tie_start:
        ET.SubElement(note, "tie", type="start")
    if tie_stop:
        ET.SubElement(note, "tie", type="stop")
    return note


def write_musicxml(notes, path: Path, tempo: float = 120.0,
                   title: str = "Bass", creator: str = "bass2tabs") -> None:
    root = ET.Element("score-partwise", version="4.0")

    work = ET.SubElement(root, "work")
    ET.SubElement(work, "work-title").text = title
    ident = ET.SubElement(root, "identification")
    ET.SubElement(ident, "creator", type="software").text = creator

    part_list = ET.SubElement(root, "part-list")
    score_part = ET.SubElement(part_list, "score-part", id="P1")
    ET.SubElement(score_part, "part-name").text = "Bass"

    part = ET.SubElement(root, "part", id="P1")

    # события в divisions (шестнадцатых): [start, dur, midi]
    events = []
    for n in notes:
        if n.start_beat is None or n.beats is None:
            continue
        start_div = int(round(n.start_beat * DIVISIONS))
        dur_div = max(1, int(round(n.beats * DIVISIONS)))
        events.append([start_div, dur_div, n.midi])

    max_div = max((s + d for s, d, _ in events), default=BAR_DIVS)
    n_bars = max(1, -(-max_div // BAR_DIVS))

    for bar in range(n_bars):
        measure = ET.SubElement(part, "measure", number=str(bar + 1))
        if bar == 0:
            attrs = ET.SubElement(measure, "attributes")
            ET.SubElement(attrs, "divisions").text = str(DIVISIONS)
            key = ET.SubElement(attrs, "key")
            ET.SubElement(key, "fifths").text = "0"
            time_el = ET.SubElement(attrs, "time")
            ET.SubElement(time_el, "beats").text = str(BEATS_PER_BAR)
            ET.SubElement(time_el, "beat-type").text = "4"
            clef = ET.SubElement(attrs, "clef")
            ET.SubElement(clef, "sign").text = "F"
            ET.SubElement(clef, "line").text = "4"

            direction = ET.SubElement(measure, "direction", placement="above")
            d_type = ET.SubElement(direction, "direction-type")
            metro = ET.SubElement(d_type, "metronome")
            ET.SubElement(metro, "beat-unit").text = "quarter"
            ET.SubElement(metro, "per-minute").text = str(int(round(tempo)))
            ET.SubElement(direction, "sound", tempo=str(int(round(tempo))))

        bar_start = bar * BAR_DIVS
        bar_end = bar_start + BAR_DIVS
        cursor = bar_start

        bar_notes = sorted(
            (e for e in events if e[0] < bar_end and e[0] + e[1] > bar_start),
            key=lambda e: e[0])

        for start_div, dur_div, midi in bar_notes:
            seg_start = max(start_div, bar_start)
            seg_end = min(start_div + dur_div, bar_end)
            seg_dur = seg_end - seg_start
            if seg_dur <= 0:
                continue
            if seg_start > cursor:
                _add_note(measure, None, seg_start - cursor)  # пауза
            tie_start = seg_end < start_div + dur_div
            tie_stop = seg_start > start_div
            _add_note(measure, midi, seg_dur, tie_start, tie_stop)
            cursor = seg_end

        if cursor < bar_end:
            _add_note(measure, None, bar_end - cursor)  # пауза в конце такта

    ET.indent(root, space="  ")
    ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)
