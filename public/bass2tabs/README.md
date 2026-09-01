# bass2tabs

Транскрибация партии **бас-гитары** из аудио (`wav` / `flac` / `mp3`) в три
нотных формата: **MIDI**, **MusicXML** и **Guitar Pro 5 (.gp5)**.
Питч-трекинг CREPE исполняется на **Apple Silicon через MPS** (torch).
Разделение микса не требуется — ожидается чистая басовая дорожка.

## Что внутри

- загрузка wav / flac / mp3 через `soundfile` (libsndfile), фолбэк — `ffmpeg`
  CLI. Не используется `torchaudio.load`, поэтому `torchcodec` не нужен;
- предобработка на CPU: моно-миксдаун, ресемплинг до 16 kHz, highpass 30 Гц,
  нормализация пика до −1 dBFS;
- питч-трекинг CREPE-full (`torchcrepe`) на MPS: чанки по 30 с, декодер
  Витерби, медианный фильтр на чистом numpy (без scipy);
- онсеты и темп — `librosa`; сегментация в ноты, квантизация к сетке 1/16;
- экспорт: MIDI (`mido`, 480 tpq), MusicXML (partwise, басовый ключ,
  tie-связки), GP5 (`PyGuitarPro`, строй E–A–D–G, минимальные лады).

## Структура проекта

```
bass2tabs/                     <- корень проекта (этот каталог)
├── README.md
├── requirements.txt
├── pyproject.toml
└── bass2tabs/                 <- Python-пакет (вложенный, то же имя!)
    ├── __init__.py
    ├── __main__.py            # python -m bass2tabs
    ├── cli.py
    ├── mps.py  audio.py  pitch.py  notes.py  text.py
    └── export_midi.py  export_xml.py  export_gp5.py
```

Критично: пакет лежит ВНУТРИ каталога проекта и называется ровно
`bass2tabs` — иначе будет «No module named bass2tabs».

## Требования

- macOS 12.3+ на Apple Silicon (M1/M2/M3/M4); из-за бага scipy на macOS 26.3+
  рекомендуем **Python 3.11+** (см. диагностику ниже);
- `ffmpeg` (для mp3): `brew install ffmpeg`;
- torch ≥ 2.1 arm64-сборка — MPS включится автоматически.

## Установка

```bash
brew install ffmpeg
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -e .                 # регистрация пакета в окружении
bass2tabs --check                # диагностика MPS
```

`pip install -e .` — штатная защита от «No module named bass2tabs»: после неё
команда работает из любой директории, а в PATH появляется `bass2tabs`.

## Быстрый старт

```bash
bass2tabs take.wav -o out --formats midi,musicxml,gp5
bass2tabs slap.flac --device mps --model full --grid 16 --tempo 112
bass2tabs demo.mp3 --range E1:E4 --min-duration 0.06 -v
```

На выходе — `out/take.mid`, `out/take.musicxml`, `out/take.gp5`.

## Флаги CLI

| флаг            | по умолчанию       | смысл                                       |
|-----------------|--------------------|---------------------------------------------|
| `--formats`     | все три            | подмножество `midi,musicxml,gp5`            |
| `--device`      | `auto`             | `auto / mps / cuda / cpu`                   |
| `--model`       | `full`             | ёмкость CREPE: `full / tiny`                |
| `--hop-ms`      | `8`                | шаг питч-трекинга, мс (5–10)                |
| `--confidence`  | `0.5`              | порог уверенности голосовых фреймов         |
| `--min-duration`| `0.08`             | минимальная длительность ноты, с            |
| `--note-range`  | `E1:E4`            | рабочий диапазон                            |
| `--grid`        | `16`               | сетка квантизации (8 / 16)                  |
| `--tempo`       | авто               | темп BPM                                    |
| `--batch`       | авто (64 MPS)      | батч CREPE; уменьшайте при abort Metal      |
| `--program`     | `34`               | MIDI-программа (33 finger / 34 pick)        |
| `--title`       | имя файла          | название в метаданных                       |
| `--artist`      | —                  | исполнитель (GP5)                           |
| `-v/--verbose`  | —                  | печатать каждую ноту                        |
| `--check`       | —                  | диагностика окружения                       |

## Диагностика (частые ошибки)

- **«No module named bass2tabs»** — запускайте из корня проекта или выполните
  `pip install -e .` (см. выше).
- **«No matching distribution found for torch-mel-crepe»** — пакет называется
  `torchcrepe` (одно слово): `pip install "torchcrepe>=0.0.22"`.
- **«No matching distribution found for guitarpro»** — дистрибутив называется
  `PyGuitarPro`: `pip install "PyGuitarPro>=0.6"`.
- **ImportError dlopen `_spropack.so` / «__thread_bss … offset is not zero»** —
  битые Mach-O-секции scipy ≤ 1.16 на macOS 26.3+ (scipy/scipy#25635). Сам
  bass2tabs scipy не импортирует (фильтры на numpy), но её транзитивно грузят
  librosa/torchcrepe. Лечение — venv на Python 3.11+:
  `brew install python@3.12 && python3.12 -m venv .venv &&
  pip install -r requirements.txt && pip install -e .`
- **«Failed to allocate IOGPUDeviceShmem» / zsh: abort** — Metal-драйвер
  отказывается выделять крупные GPU-буферы. bass2tabs защищён: DSP на CPU,
  CREPE — чанками в дочернем процессе с авто-откатом на CPU. Снизить шанс
  аборта: `--batch 32`, закрыть GPU-прожорливые приложения; гарантированный
  обход — `--device cpu`.
- **«ModuleNotFoundError: torchcodec»** — у вас старая версия `audio.py` с
  `torchaudio.load`. Обновите файл: чтение идёт через `soundfile`/`ffmpeg`.

## Лицензия

MIT. Зависимости: torch, torchaudio, torchcrepe, librosa, numpy, soundfile,
mido, PyGuitarPro (import guitarpro).
