"""Экспорт в Guitar Pro 5 (.gp5) через PyGuitarPro (import guitarpro).

GP хранит ноты как (струна, лад). Строй 4-струнного баса E-A-D-G; для ноты
выбирается минимальный лад — позиции остаются читаемыми. Названия и
исполнитель — через to_latin1 (формат GP 8-битный).
"""

from __future__ import annotations

import math
from pathlib import Path

import guitarpro as gp

from .text import to_latin1

try:  # в части сборок Tempo отсутствует в top-level __all__
    from guitarpro.models import Tempo as _Tempo
except ImportError:  # pragma: no cover
    _Tempo = gp.Tempo

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

    В guitarpro Duration.value — знаменатель ноты:
    1 целая, 2 половина, 4 четверть, 8 восьмая, 16 шестнадцатая.
    Нота длиной steps шестнадцатых имеет value = 16 / steps.
    """
    valid = (1, 2, 4, 8, 16)
    target = 16 / max(1, steps)
    return min(valid, key=lambda v: abs(v - target))


def _add_rest(voice, steps: int) -> None:
    """Бит без нот записывается как пауза."""
    beat = gp.Beat(voice, duration=gp.Duration(value=_duration_value(steps)))
    voice.beats.append(beat)


def write_gp5(notes, path: Path, tempo: float = 120.0,
              title: str = "Bass", artist: str = "") -> None:
    song = gp.Song()
    song.title = to_latin1(title)
    song.artist = to_latin1(artist)
    tempo_val = int(round(tempo))
    # Song.tempo по умолчанию — int (120), райтер ждёт именно int;
    # в сам файл темп пишется из header.tempo (объект Tempo, ниже).
    song.tempo = tempo_val

    # У свежей gp.Song() дефолтный трек уже есть, но подстрахуемся.
    track = song.tracks[0] if song.tracks else gp.Track(song)
    if not song.tracks:
        song.tracks.append(track)
    track.name = "Bass"
    track.strings = [
        gp.GuitarString(number=i + 1, value=v)
        for i, v in enumerate(BASS_TUNING)
    ]
    track.channel.instrument = 34  # Electric Bass (pick)

    max_beat = max((n.start_beat + n.beats for n in notes), default=4.0)
    n_bars = max(1, math.ceil(max_beat / 4.0))

    # Меры и их заголовки создаём явно и синхронно. У Measure НЕТ метода
    # clone, поэтому каждый такт строится заново. Такт 4/4 = 3840 тиков
    # (доля = 960); в GP первый такт стартует с 960, а не с нуля.
    song.measureHeaders = []
    track.measures = []
    for i in range(n_bars):
        header = gp.MeasureHeader()
        header.number = i + 1
        header.start = 960 + i * 3840
        header.tempo = _Tempo(tempo_val)
        header.timeSignature.numerator = 4
        header.timeSignature.denominator.value = 4
        song.measureHeaders.append(header)
        measure = gp.Measure(track, header)
        # В GP5 у каждого такта два голоса: ноты — в первый, второй пустой.
        measure.voices = [gp.Voice(measure), gp.Voice(measure)]
        track.measures.append(measure)

    for bar, measure in enumerate(track.measures):
        voice = measure.voices[0]
        voice.beats = []

        events = sorted(
            (n for n in notes if bar * 4 <= n.start_beat < (bar + 1) * 4),
            key=lambda n: n.start_beat)
        cursor = 0  # позиция в шестнадцатых
        for n in events:
            start16 = int(round((n.start_beat - bar * 4) * 4))
            if start16 > cursor:
                _add_rest(voice, start16 - cursor)
            steps = max(1, int(round(n.beats * 4)))
            steps = min(steps, BAR_STEPS - start16)

            beat = gp.Beat(voice, duration=gp.Duration(value=_duration_value(steps)))
            fret, string = _fret_for(n.midi)
            # Note.value — номер ЛАДА (реальная высота = value + строй струны).
            # type=normal обязателен: дефолтный NoteType.rest записал бы битый байт.
            note = gp.Note(beat, value=fret, velocity=n.velocity, string=string,
                           type=gp.NoteType.normal)
            beat.notes.append(note)
            voice.beats.append(beat)
            cursor = start16 + steps

        if cursor < BAR_STEPS:
            _add_rest(voice, BAR_STEPS - cursor)

    gp.write(song, str(path))
