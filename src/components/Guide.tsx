import { Command, CopyButton, Reveal, SectionHeading } from "./Shell";

const STEPS = [
  {
    title: "Системные зависимости",
    cmd: "brew install ffmpeg",
    note: "ffmpeg (CLI) — фолбэк-загрузчик для mp3 и экзотики; основной путь — soundfile (libsndfile), он читает wav/flac напрямую, а на libsndfile 1.1+ и mp3. torchaudio.load не используется, поэтому torchcodec не нужен.",
  },
  {
    title: "Структура: пакет ВНУТРИ проекта",
    cmd: "mkdir -p bass2tabs",
    note: "Корень проекта содержит requirements.txt, pyproject.toml и README.md, а десять .py-файлов лежат во вложенном каталоге bass2tabs/ — именно его ищет «python -m bass2tabs». Файлы копируются из раздела «Исходники».",
  },
  {
    title: "Виртуальное окружение",
    cmd: "python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt",
    note: "Тяжелеет на torch (~60 МБ wheel для arm64) и librosa; на Apple Silicon из PyPI приедет сборка с MPS из коробки. Сам bass2tabs scipy не использует (фильтры — чистый numpy), но её транзитивно грузят librosa/torchcrepe — поэтому на macOS Tahoe 26.3+ venv делайте на Python 3.11+ (python3.12 -m venv .venv): на 3.10 не встанет исправленная scipy ≥ 1.17.",
  },
  {
    title: "Регистрация пакета",
    cmd: "pip install -e .",
    note: "Ставит bass2tabs в venv в режиме editable: «No module named bass2tabs» больше невозможен, команда работает из любой директории, а в PATH появляется команда bass2tabs.",
  },
  {
    title: "Проверка MPS и первый прогон",
    cmd: "bass2tabs --check && bass2tabs my-take.wav -o out -v",
    note: "--check гоняет тестовый matmul на выбранном устройстве; -v печатает таблицу всех найденных нот. Эквивалент: python -m bass2tabs …",
  },
];

const CLI_ROWS: [string, string, string][] = [
  ["--formats", "midi,musicxml,gp5", "подмножество выходных форматов через запятую"],
  ["--device", "auto", "auto → mps → cuda → cpu; можно форсировать mps или cpu"],
  ["--hop-ms", "8", "шаг питч-трекинга, мс: 5 — плотнее для быстрых партий"],
  ["--model", "full", "ёмкость CREPE: full / tiny (веса, которые публикует torchcrepe)"],
  ["--confidence", "0.5", "порог «озвученных» фреймов: выше — меньше призрачных нот"],
  ["--min-duration", "0.08", "ноты короче порога отбрасываются как шум, сек"],
  ["--range", "E1:G4", "допустимый диапазон нотными именами"],
  ["--grid", "16", "квантизация: 4 / 8 / 16 делений на целую ноту"],
  ["--tempo", "авто", "фиксированный BPM вместо оценки beat_track"],
  ["--program", "34", "MIDI-программа: 33 finger · 34 pick · 35 slap"],
  ["--title / --artist", "имя файла", "метаданные партитуры (MusicXML, GP5)"],
  ["-v, --verbose", "выкл", "таблица всех нот: старт, имя, длительность, velocity"],
  ["--check", "—", "диагностика окружения, torch и доступности MPS"],
];

export function Guide() {
  return (
    <section id="setup" className="scroll-mt-24 border-t border-line bg-ink-2/40 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="04 · Установка"
          title="Пять команд — и пакет транскрибирует"
          lead="Ничего, кроме macOS на Apple Silicon и Homebrew, не предполагается. Весь инференс локальный: файл никуда не отправляется."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.25fr_0.75fr]">
          <ol className="space-y-8">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 80}>
                  <div className="flex items-baseline gap-4">
                    <span className="font-display text-[26px] font-black leading-none text-amber/30">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-[15px] font-bold text-paper">{s.title}</h3>
                      <div className="mt-3">
                        <Command cmd={s.cmd} note={s.note} />
                      </div>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>

          <Reveal delay={200}>
            <aside className="card-lift rounded-xl border border-line bg-panel p-6 lg:sticky lg:top-24">
              <div className="flex items-center gap-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="4" stroke="#f2a33c" strokeWidth="1.7" />
                  <path d="M8 12h2l1.5-3.5 2 7L15 12h1.5" stroke="#f2a33c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3 className="font-display text-[15px] font-bold text-paper">Чек-лист MPS</h3>
              </div>
              <ul className="mt-5 space-y-3.5 text-[13.5px] leading-relaxed text-dim">
                {[
                  <>
                    <b className="text-paper">macOS 12.3+</b> — Metal-бэкенд PyTorch появился в Monterey.
                  </>,
                  <>
                    <b className="text-paper">arm64-сборка torch</b> — под Rosetta MPS не виден. Проверка:
                  </>,
                ].map((li, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-sm bg-phos" aria-hidden="true" />
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 overflow-hidden rounded-lg border border-line bg-ink-2">
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                  <code className="break-all font-mono text-[11px] text-phos">
                    python -c "import torch; print(torch.backends.mps.is_available())"
                  </code>
                  <CopyButton
                    text='python -c "import torch; print(torch.backends.mps.is_available())"'
                    compact
                  />
                </div>
              </div>
              <ul className="mt-5 space-y-3.5 text-[13.5px] leading-relaxed text-dim">
                {[
                  <>
                    <b className="text-paper">Загрузка GPU</b> — Activity Monitor → вкладка Window → GPU History.
                  </>,
                  <>
                    <b className="text-paper">Фолбэк</b> — на Intel-маке или Linux всё работает на CPU/CUDA:{" "}
                    <code className="font-mono text-[12px] text-amber">--device cpu</code>.
                  </>,
                ].map((li, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-sm bg-amber" aria-hidden="true" />
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </Reveal>
        </div>

        {/* CLI reference */}
        <Reveal className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h3 className="font-display text-[20px] font-bold text-paper">Справочник флагов</h3>
            <span className="font-mono text-[11.5px] text-faint">
              python -m bass2tabs <span className="text-amber">input</span> [опции]
            </span>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="code-scroll mt-6 overflow-x-auto rounded-xl border border-line bg-panel">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-ink-2/80">
                  <th className="px-5 py-3.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-faint">
                    флаг
                  </th>
                  <th className="px-5 py-3.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-faint">
                    по умолчанию
                  </th>
                  <th className="px-5 py-3.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-faint">
                    что делает
                  </th>
                </tr>
              </thead>
              <tbody>
                {CLI_ROWS.map(([flag, def, desc], i) => (
                  <tr
                    key={flag}
                    className={`border-b border-line/60 transition-colors duration-150 hover:bg-amber/[0.045] ${
                      i % 2 ? "bg-ink-2/30" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[12.5px] font-medium text-amber">
                      {flag}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[12px] text-phos/80">{def}</td>
                    <td className="px-5 py-3 text-[13px] text-dim">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
