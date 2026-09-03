"""Экспорт в Standard MIDI File (mido): 480 tpq, дельта-события, program 34.

Название трека — через to_latin1: формат SMF хранит текст в latin-1
(mido кодирует им намеренно), кириллица вызвала бы UnicodeEncodeError.
"""

from __future__ import annotations

from pathlib import Path

import mido

from .text import to_latin1

TPQ = 480  # тиков в четверти


def write_midi(notes, path: Path, tempo: float = 120.0,
               program: int = 34, title: str = "Bass") -> None:
    mid = mido.MidiFile(ticks_per_beat=TPQ)
    track = mido.MidiTrack()
    mid.tracks.append(track)

    track.append(mido.MetaMessage("track_name", name=to_latin1(title), time=0))
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
