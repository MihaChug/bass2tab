"""Транслитерация метаданных в latin-1 для форматов SMF / Guitar Pro.

Форматы Standard MIDI File и Guitar Pro 3-5 хранят текст в 8-битных
кодировках (фактически latin-1 / cp1252). UTF-8 туда не помещается,
поэтому кириллицу и прочие не-latin-1 символы транслитерируем в читаемую
латиницу. MusicXML — это XML в UTF-8, ему данная обработка не нужна.
"""

from __future__ import annotations

import unicodedata

# Кириллица -> латиница (читаемая транслитерация, с учётом регистра).
_RU = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}

_TABLE: dict[int, str] = {}
for _lo, _lat in _RU.items():
    _TABLE[ord(_lo)] = _lat
    _TABLE[ord(_lo.upper())] = _lat.capitalize() if _lat else ""


def to_latin1(text: str) -> str:
    """Вернуть строку, которую можно безопасно закодировать в latin-1.

    1) транслитерируем кириллицу;
    2) снимаем диакритику (NFKD: é -> e);
    3) всё, что всё ещё не latin-1, заменяем на '?'.
    """
    if not text:
        return ""
    out = text.translate(_TABLE)
    out = unicodedata.normalize("NFKD", out)
    out = "".join(ch for ch in out if not unicodedata.combining(ch))
    return out.encode("latin-1", "replace").decode("latin-1")
