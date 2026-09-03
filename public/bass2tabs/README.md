# bass2tabs

Локальная транскрибация бас-гитары: **wav / flac / mp3 → MIDI, MusicXML, GP5**.
Инференс CREPE — на Apple Silicon через **MPS**; весь прочий DSP — на CPU.

## Возможности

- загрузка wav / flac / mp3 через soundfile (libsndfile), фолбэк — ffmpeg CLI.
  Не используется `torchaudio.load`, поэтому не нужен torchcodec;
- **high-pass 32 Гц перед CREPE** (срез 30–35 Гц) — убирает сценический гул и
  поднимает уверенность нейросети в полезных фреймах;
- питч-трекинг **CREPE-full** (torchcrepe, декодер Витерби) на MPS, чанки по 30 c,
  инференс в защищённом subprocess с авто-откатом на CPU;
- **двухпороговая (гистерезисная) сегментация нот**: активация при уверенности
  ≥ 0.60 (не ловим случайные касания струн), сброс при < 0.35 (затухающая нота
  держится до последнего). Звучащие сегменты режутся онсетами librosa;
- авто-темп (beat_track, 70–170 BPM) или `--tempo`, квантизация к сетке 1/16;
- экспорт: `.mid` (mido, 480 tpq), `.musicxml` (partwise, басовый ключ, UTF-8),
  `.gp5` (PyGuitarPro, строй E–A–D–G, минимальные лады, latin-1).

## Требования

- macOS 12.3+ на Apple Silicon (M1/M2/M3/M4), **Python 3.11+** (на 3.10 не
  ставится исправленная scipy, см. диагностику); ffmpeg (`brew install ffmpeg`);
- torch >= 2.1 arm64-сборка — MPS включится автоматически.

## Структура проекта

    bass2tabs/                     <- корень проекта (этот каталог)
    ├── README.md
    ├── requirements.txt
    ├── pyproject.toml
    └── bass2tabs/                 <- Python-пакет (вложенный, то же имя!)
        ├── __init__.py  __main__.py  cli.py
        ├── mps.py  audio.py  pitch.py  notes.py  text.py
        └── export_midi.py  export_xml.py  export_gp5.py

Критично: пакет лежит ВНУТРИ каталога проекта и называется ровно `bass2tabs` —
иначе будет «No module named bass2tabs».

## Установка

    brew install ffmpeg
    python3.12 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    pip install -e .                 # регистрация пакета в окружении
    bass2tabs --check                # диагностика MPS

## Быстрый старт

    bass2tabs take.wav -o out --formats midi,musicxml,gp5

Настройки гистерезиса и фильтра:

    bass2tabs take.wav --on-thr 0.6 --off-thr 0.35 --highpass 32

| флаг             | по умолчанию | смысл                                          |
|------------------|--------------|------------------------------------------------|
| `--on-thr`       | 0.60         | порог активации ноты (вкл)                     |
| `--off-thr`      | 0.35         | порог сброса ноты (выкл)                       |
| `--highpass`     | 32           | срез high-pass, Гц (0 = выключить)             |
| `--model`        | full         | ёмкость CREPE: full / tiny                     |
| `--batch`        | авто         | батч инференса (64 mps / 2048 cpu)             |
| `--hop-ms`       | 8            | шаг фреймов CREPE, мс                          |
| `--tempo`        | авто         | фиксированный BPM                              |
| `--grid`         | 16           | сетка квантизации (делений на целую)           |
| `--min-duration` | 0.08         | мин. длительность ноты, c                      |
| `--device`       | auto         | auto / mps / cuda / cpu                        |

## Диагностика

- «No module named bass2tabs» → запустите из корня проекта или выполните
  `pip install -e .`;
- pip: «No matching distribution found for torch-mel-crepe» → пакет называется
  `torchcrepe` (одно слово): `pip install "torchcrepe>=0.0.22"`;
- pip: «No matching distribution found for guitarpro» → дистрибутив
  `PyGuitarPro`: `pip install "PyGuitarPro>=0.6"`;
- ImportError dlopen `_spropack.so` («__thread_bss … offset is not zero») →
  scipy ≤ 1.16 на macOS 26.3+; сам bass2tabs scipy не импортирует, но её грузят
  librosa/torchcrepe. Лечение — venv на Python 3.11+ (см. установку);
- «Failed to allocate IOGPUDeviceShmem» и `zsh: abort` → abort Metal-драйвера
  (не перехватывается). bass2tabs защищён: DSP на CPU, инференс в subprocess с
  авто-откатом на CPU, чанки 30 c. Снизить шанс: `--batch 32`, закрыть
  GPU-приложения. Гарантированный обход — `--device cpu`;
- прогон «виснет» на 100 % → дедлок multiprocessing.Queue; в текущем коде
  результат вычитывается до join. Обновите pitch.py;
- экспорт падал на кириллице → теперь транслитерация в latin-1 (text.py);
  для MIDI/GP5 названия — латиницей, в MusicXML кириллица сохраняется.

## Лицензия

MIT. Зависимости: torch, torchaudio, torchcrepe, librosa, numpy, soundfile,
mido, PyGuitarPro (import guitarpro).
