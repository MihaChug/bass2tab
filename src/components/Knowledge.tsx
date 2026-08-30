import { useState } from "react";
import { Reveal, SectionHeading } from "./Shell";

const BLOCKS = [
  {
    id: "mono",
    title: "Почему монофонический питч-трекинг",
    body: [
      "Басовая партия — почти всегда одна нота в момент времени: даже в слэпе аккорды — редкость. Поэтому вместо тяжёлой полифонической расшифровки (Basic Pitch, Spotify) здесь работает CREPE — детектор высоты одного голоса с точностью до долей цента.",
      "CREPE устойчив к тембру: перегруз, компрессор и струны с обмоткой почти не сбивают модель, потому что она обучалась на сыром волновом сигнале, а не на нотах. Канонический PyTorch-порт — пакет torchcrepe из PyPI: инференс уходит на MPS через параметр device, без переписывания пайплайна.",
    ],
    snippet: "model_capacity='full'  # ~24.4M параметров, fmin=E1, fmax=G4",
  },
  {
    id: "viterbi",
    title: "Витерби против argmax",
    body: [
      "Сырой выход модели — 360 бинов вероятности на фрейм. Argmax по кадрам даёт «пилу» из октавных скачков, поэтому включён декодер Витерби: матрица переходов штрафует скачки больше ~25 центов за фрейм, и контур f0 остаётся гладким даже на вибрато и слайдах.",
      "Сверху — медианный фильтр на 5 фреймов: он добивает одиночные выбросы, которые Витерби пропустил на границах тишины.",
    ],
    snippet: "torchcrepe.predict(..., viterbi) → _medfilt1d(·, 5)  # чистый numpy",
  },
  {
    id: "cents",
    title: "Из центов — в MIDI",
    body: [
      "CREPE считает центы от опорных 10 Гц, поэтому перевод в MIDI-номер — одна строка: midi = cents/100 + 3.4868 (это 69 + 12·log₂(440/10)/100 − 65.513, если раскладывать).",
      "Внутри сегмента между двумя онсетами берётся медиана центов по «озвученным» фреймам (confidence ≥ порога). Медиана нечувствительна к вибрато ±30–40 центов: нота не перескакивает на соседний полутон, пока контур реально не ушёл.",
    ],
    snippet: "midi = round(cents / 100 + 3.4868)   # E1=41.2 Hz → 28",
  },
  {
    id: "rhythm",
    title: "Ритм: онсеты, темп, сетка",
    body: [
      "Атаки ищет librosa.onset.onset_detect с backtracking — старт ноты отодвигается к фронту энергии, а не к пику огибающей. Темп — beat_track с приведением в 70–170 BPM; сетка квантизации 1/16 (флаг --grid).",
      "После снэпа соседние ноты могут наехать друг на друга — хвост предыдущей укорачивается до старта следующей. Velocity — RMS первых трёх фреймов после атаки, нормированный на 30–120 по всему тейку: тихие пальцы и жёсткий слэп остаются различимыми.",
    ],
    snippet: "step = 4 / grid  # 16 → 0.25 доли; overlaps → обрезаются",
  },
  {
    id: "frets",
    title: "Струны и лады для табулатуры",
    body: [
      "GP5 хранит не высоту, а позицию: (струна, лад). Строй стандартный — E1 A1 D2 G2 (в GP струна №1 — самая высокая). Для ноты перебираются все струны, где fret = midi − open_string попадает в 0–24, и выбирается минимальный лад.",
      "Пример: E3 (midi 52) → 1-я струна, 9-й лад — против 14-го на 2-й. Позиции остаются в первых ладах, и табулатуру можно читать сразу, не переставляя пальцы по грифу.",
    ],
    snippet: "fret = midi - open_string   # min(fret) при 0 ≤ fret ≤ 24",
  },
];

export function DeepDive() {
  return (
    <section id="algo" className="scroll-mt-24 border-t border-line py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* sticky intro */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              kicker="05 · Алгоритм"
              title="От волны до лада"
              lead="Пять решений, на которых держится точность. Каждое — осознанный компромисс между робастностью и музыкальностью результата."
            />
            <Reveal delay={150}>
              <ol className="mt-8 space-y-2.5">
                {BLOCKS.map((b, i) => (
                  <li key={b.id}>
                    <a
                      href={`#algo-${b.id}`}
                      className="group flex items-baseline gap-3 font-mono text-[12.5px] text-dim transition-colors hover:text-amber"
                    >
                      <span className="text-[10.5px] text-faint group-hover:text-amber/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="link-sweep">{b.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={220}>
              <div className="mt-10 hidden rounded-xl border border-line bg-panel p-5 lg:block">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">ориентиры точности</p>
                <dl className="mt-4 space-y-3">
                  {[
                    ["чистый сигнал, пальцы", "~96–99% нот"],
                    ["слэп с призрачными", "~90–95% нот"],
                    ["сильный перегруз", "~85–92% нот"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4">
                      <dt className="text-[12.5px] text-dim">{k}</dt>
                      <dd className="font-mono text-[12px] font-medium text-phos">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[11px] leading-relaxed text-faint">
                  Субъективная оценка на домашних записях DI; метрики зависят от чистоты атак.
                </p>
              </div>
            </Reveal>
          </div>

          {/* blocks */}
          <div className="space-y-14">
            {BLOCKS.map((b, i) => (
              <Reveal key={b.id} delay={i * 60}>
                <article id={`algo-${b.id}`} className="scroll-mt-28 border-l-2 border-amber/35 pl-6 transition-colors duration-300 hover:border-amber/70 sm:pl-8">
                  <h3 className="font-display text-[19px] font-bold text-paper">{b.title}</h3>
                  {b.body.map((p, j) => (
                    <p key={j} className="mt-3.5 text-[14.5px] leading-relaxed text-dim">
                      {p}
                    </p>
                  ))}
                  <pre className="mt-5 overflow-x-auto rounded-lg border border-line bg-ink-2 px-4 py-3 font-mono text-[12px] text-phos">
                    {b.snippet}
                  </pre>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================= FAQ ================= */

const FAQ = [
  {
    q: "Assertion failed: «Failed to allocate IOGPUDeviceShmem» и zsh: abort",
    a: "Это падает не Python, а Metal-драйвер macOS 27.0: он abort'ит крупные выделения общей GPU-памяти (SIGABRT), и перехватить его try/except принципиально нельзя. В bass2tabs это закрыто с двух сторон. Во-первых, вся предобработка аудио — миксдаун, ресемплинг, highpass, нормализация — теперь считается на CPU: раньше именно первое wav.to(mps) с целой стерео-волной убивало процесс ещё до CREPE. Во-вторых, сам MPS-инференс CREPE запускается в ДОЧЕРНЕМ процессе: если драйвер его убивает (exitcode != 0), родитель ловит это и автоматически повторяет прогон на CPU — транскрибация завершится в любом случае. Дополнительно трек идёт чанками по 30 с с очисткой Metal-кэша, батч на MPS консервативный (64), а cli.py до импорта torch выставляет PYTORCH_ENABLE_MPS_FALLBACK=1. Обновите bass2tabs/audio.py, pitch.py и cli.py из «Исходников». Если хотите остаться на GPU и снизить шанс аборта: --batch 32, закройте GPU-прожорливые приложения. Гарантированный обход — --device cpu (точность та же, медленнее).",
  },
  {
    q: "«No module named bass2tabs» — Python не видит пакет",
    a: "python -m bass2tabs ищет каталог bass2tabs/ с __init__.py либо в текущей директории, либо среди установленных пакетов. Два решения. Быстрое: запускать команду из корня проекта — того каталога, внутри которого лежит bass2tabs/ (структура: bass2tabs/bass2tabs/__init__.py). Кардинальное: выполнить в корне проекта pip install -e . (файл pyproject.toml входит в состав) — пакет зарегистрируется в venv, команда будет работать из любой директории, а в PATH появится консольная команда bass2tabs.",
  },
  {
    q: "ImportError: TorchCodec is required for load_with_torchcodec",
    a: "В torchaudio 2.6+ полностью убрали старые бэкенды: аргумент backend=\"soundfile\"/\"ffmpeg\" в torchaudio.load игнорируется, и загрузка теперь всегда идёт через пакет torchcodec, которого нет в окружении. С версии 0.1.0 bass2tabs вообще не вызывает torchaudio.load: чтение сделано через soundfile (libsndfile — wav/flac, а на libsndfile 1.1+ и mp3) с фолбэком на ffmpeg CLI (brew install ffmpeg). torchaudio остался только для DSP-функционала (ресемплинг, highpass), который от бэкендов не зависит. Обновите bass2tabs/audio.py и requirements.txt — и ошибка исчезнет без установки torchcodec.",
  },
  {
    q: "ImportError: dlopen _spropack.so — «__thread_bss … offset field is not zero»",
    a: "Это падает scipy ≤ 1.16 на macOS Tahoe 26.3+: ужесточённый dyld перестал пропускать битые Mach-O-секции в её Fortran-расширениях (scipy/scipy#25635). С версии 0.1.0 сам bass2tabs scipy не импортирует — медианные фильтры написаны на чистом numpy (_medfilt1d в pitch.py). Но важно: scipy при импорте подгружают транзитивные зависимости librosa и torchcrepe. Поэтому на Python 3.10 ошибка не исчезает, а переезжает внутрь import torchcrepe и выглядит как «Не найден torchcrepe» — хотя pip show пакет находит. Надёжное лечение — пересоздать venv на Python 3.11+: туда pip поставит scipy ≥ 1.17, где PROPACK переписан на C и секции корректны. Целиком: brew install python@3.12 && python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && pip install -e .",
  },
  {
    q: "pip пишет «No matching distribution found for torch-mel-crepe»",
    a: "Пакет в PyPI называется torchcrepe — одним словом, без дефисов; имени torch-mel-crepe там никогда не было. В текущем requirements.txt это исправлено: pip install \"torchcrepe>=0.0.22\". Проверить, что всё подтянулось, можно командой bass2tabs --check — она напечатает версию torchcrepe. Если же pip show torchcrepe пакет находит, а импорт всё равно падает — программа теперь печатает истинную причину в строке «причина:»: почти наверняка это не установка, а упавшая транзитивная зависимость (на macOS 26.3+ — scipy, см. следующий пункт).",
  },
  {
    q: "MPS не обнаруживается — что делать?",
    a: "Проверьте по шагам: macOS ≥ 12.3, Python запущен нативно (без Rosetta — arch в выводе uname -m должен быть arm64), torch установлен из PyPI для arm64. Запустите python -m bass2tabs --check. Если MPS так и нет, приложение честно отработает на CPU с флагом --device cpu.",
  },
  {
    q: "pip: «No matching distribution found» для torch-mel-crepe / guitarpro",
    a: "Оба дистрибутива в PyPI называются иначе, чем хотелось бы: питч-трекер — torchcrepe (одно слово, pip install \"torchcrepe>=0.0.22\"), парсер табулатур — PyGuitarPro (pip install \"PyGuitarPro>=0.6\"), при этом в коде он импортируется как import guitarpro. В исправленном requirements.txt оба имени уже верные — переустановите зависимости из него.",
  },
  {
    q: "mp3-файл не читается",
    a: "Нужен ffmpeg: brew install ffmpeg. Начиная с soundfile 0.13 mp3 читается и без него, но ffmpeg-фолбэк в audio.py надёжнее и заодно понимает всё, что умеет читать ffmpeg (m4a, ogg).",
  },
  {
    q: "Ноты дробятся или дублируются",
    a: "Поднимите --min-duration до 0.10–0.15 и --confidence до 0.6. Для быстрых шестнадцатых на 160 BPM наоборот: --min-duration 0.05 и --hop-ms 5. Модель full обязательна для слэпа — tiny путает октавы.",
  },
  {
    q: "Пропускает тихие ноты, ловит «призраков» на паузах",
    a: "Это две стороны порога --confidence: ниже (0.35) — слышны ghost-ноты и легато, выше (0.65) — тишина чище. Пайплайн уже нормализует пик до −1 dBFS, но совсем тихую запись лучше поднять в DAW перед прогоном.",
  },
  {
    q: "Работает ли на Intel Mac или Linux?",
    a: "Да. --device auto выберет CUDA (Linux с GPU) или CPU. Логика пайплайна идентична, отличается только скорость CREPE: на CPU модель full — примерно в реальном времени, на MPS — в 3–6 раз быстрее.",
  },
  {
    q: "Почему лады в GP5 не такие, как я играю?",
    a: "Экспорт использует эвристику минимального лада — одну ноту на басе можно взять 2–4 способами, и универсального «правильного» нет. Высоты при этом точные: переставить аппликатуру в Guitar Pro — секунда на ноту.",
  },
  {
    q: "Как убедиться, что CREPE реально считается на GPU?",
    a: "Откройте Activity Monitor → Window → GPU History: во время прогона появится загрузка. В терминале строка «CREPE-full (mps)» показывает устройство и время; сравните с --device cpu на том же файле.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section id="faq" className="scroll-mt-24 border-t border-line bg-ink-2/40 py-24 sm:py-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <SectionHeading
          kicker="06 · FAQ"
          title="Вопросы, которые задают после первого прогона"
        />
        <div className="mt-12 space-y-3">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 50}>
                <div
                  className={`overflow-hidden rounded-xl border transition-colors duration-300 ${
                    isOpen ? "border-amber/40 bg-panel" : "border-line bg-panel/60 hover:border-amber/25"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                    aria-expanded={isOpen}
                  >
                    <span className="font-display text-[14.5px] font-bold text-paper sm:text-[15.5px]">
                      {item.q}
                    </span>
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border transition-all duration-300 ${
                        isOpen ? "rotate-45 border-amber text-amber" : "border-line text-dim"
                      }`}
                      aria-hidden="true"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                  </button>
                  <div className={`acc-body ${isOpen ? "open" : ""}`}>
                    <div className="acc-inner">
                      <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-dim sm:px-6">{item.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
