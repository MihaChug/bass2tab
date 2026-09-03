import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion, useScramble } from "./hooks";
import {
  Command,
  CopyButton,
  Footer,
  Nav,
  Reveal,
  SectionHeading,
} from "./ui";
import { CodeBrowser } from "./components/CodeBrowser";

/* ================= terminal ================= */

type TermLine = { text: string; cls: string; pause?: number };

const LINES: TermLine[] = [
  { text: "$ bass2tabs ~/Music/bass-takes -o out -r", cls: "text-paper", pause: 500 },
  { text: "torch 2.13.0 · python 3.12 · macOS 27.0 · arm64 · устройство: mps", cls: "text-faint", pause: 180 },
  { text: "▸ пакет: 3 файла из ~/Music/bass-takes", cls: "text-amber", pause: 320 },
  { text: "[1/3] verse.wav", cls: "text-paper", pause: 200 },
  { text: "  · CREPE-full (mps): 28 240 фреймов · 9 чанков · 21.4 c", cls: "text-phos", pause: 260 },
  { text: "  · сегментация: 196 нот · 118 BPM · ok verse.mid/musicxml/gp5", cls: "text-dim", pause: 260 },
  { text: "[2/3] chorus.wav", cls: "text-paper", pause: 200 },
  { text: "  · сегментация: 231 нот · 118 BPM · ok chorus.mid/musicxml/gp5", cls: "text-dim", pause: 260 },
  { text: "[3/3] bridge.mp3", cls: "text-paper", pause: 200 },
  { text: "  · сегментация: 148 нот · 116 BPM · ok bridge.mid/musicxml/gp5", cls: "text-dim", pause: 320 },
  { text: "════════════════════════════════════════════════", cls: "text-faint", pause: 120 },
  { text: "· пакет готов: 3/3 файлов · 575 нот · 11:23 аудио · 58.7 c", cls: "text-phos", pause: 600 },
];

function Terminal({ reduced }: { reduced: boolean }) {
  const [li, setLi] = useState(reduced ? LINES.length : 0);
  const [ch, setCh] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let t = 0;
    if (li >= LINES.length) {
      t = window.setTimeout(() => {
        setLi(0);
        setCh(0);
      }, 3800);
    } else if (ch < LINES[li].text.length) {
      t = window.setTimeout(() => setCh((c) => c + 2), 12);
    } else {
      t = window.setTimeout(() => {
        setLi((l) => l + 1);
        setCh(0);
      }, LINES[li].pause ?? 260);
    }
    return () => window.clearTimeout(t);
  }, [li, ch, reduced]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-ink-2/95 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.85)]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-alert/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-phos/70" />
        <span className="ml-3 font-mono text-[11px] text-faint">bass2tabs — zsh · 92×24</span>
        <span className="ml-auto rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-phos">mps</span>
      </div>
      <div className="code-scroll min-h-[300px] overflow-x-auto px-4 py-4 font-mono text-[12px] leading-[1.85] sm:text-[12.5px]">
        {LINES.slice(0, Math.min(li, LINES.length)).map((l, i) => (
          <div key={i} className={`whitespace-pre ${l.cls}`}>
            {l.text}
          </div>
        ))}
        {li < LINES.length && !reduced && (
          <div className={`whitespace-pre ${LINES[li].cls}`}>
            {LINES[li].text.slice(0, ch)}
            <span className="term-caret ml-px" />
          </div>
        )}
        {(li >= LINES.length || reduced) && (
          <div className="whitespace-pre text-paper">
            $ <span className="term-caret" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= equalizer ================= */

const EQ = [26, 44, 62, 84, 58, 96, 70, 40, 88, 52, 74, 34, 60, 46, 80, 30, 56, 42];

function Equalizer() {
  return (
    <div className="flex h-24 items-end gap-1.5" aria-hidden="true">
      {EQ.map((h, i) => (
        <span
          key={i}
          className="eq-bar w-[7px] rounded-t-[3px]"
          style={{
            height: `${h}%`,
            background:
              i % 4 === 0
                ? "linear-gradient(180deg, #f2a33c, #d97f1e)"
                : "linear-gradient(180deg, rgba(67,201,162,0.9), rgba(67,201,162,0.35))",
            animationDelay: `${(i % 6) * 0.13}s`,
            animationDuration: `${0.9 + (i % 5) * 0.14}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ================= hero ================= */

const BADGES = ["torch ≥ 2.1", "MPS", "CREPE-full · viterbi", "гистерезис 0.6/0.35", "HP 32 Гц", "silence −60 дБ", "коридор 0.55 пт", "MIDI", "MusicXML", "GP5"];

function Hero() {
  const reduced = usePrefersReducedMotion();
  const title = useScramble("bass2tabs");

  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-panel px-3.5 py-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber" />
                </span>
                <span className="font-mono text-[11px] font-medium tracking-wide text-dim">
                  python · apple silicon · полностью локально
                </span>
              </div>
            </Reveal>

            <h1 className="mt-7 font-display text-[42px] font-black leading-[0.98] tracking-tight text-paper sm:text-[60px] lg:text-[68px]">
              <span className="whitespace-pre">{title}</span>
              <span className="mt-2 block text-[20px] font-medium leading-snug text-dim sm:text-[24px]">
                партия баса из аудио —<br />в <span className="text-amber">MIDI</span>,{" "}
                <span className="text-amber">MusicXML</span> и <span className="text-amber">GP5</span>
              </span>
            </h1>

            <Reveal delay={120}>
              <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-dim">
                Python-приложение для транскрибации записи бас-гитары
                (wav&nbsp;/&nbsp;flac&nbsp;/&nbsp;mp3). CREPE исполняется на GPU через{" "}
                <span className="font-mono text-[14px] text-phos">MPS</span>. Ноты выделяются
                двухпороговой гистерезисной системой — <span className="text-amber">0.6</span> на
                включение, <span className="text-amber">0.35</span> на сброс, — а перед CREPE сигнал
                проходит high-pass 32&nbsp;Гц. Высота декодируется Витерби, тишина обнуляется,
                частотный коридор ~0.55 полутона гасит вибрато. Разделение микса не требуется.
              </p>
            </Reveal>

            <Reveal delay={200}>
              <div className="mt-7 flex flex-wrap gap-2">
                {BADGES.map((b) => (
                  <span
                    key={b}
                    className="rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-[11.5px] font-medium text-dim transition-colors duration-200 hover:border-amber/40 hover:text-amber"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={280}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <a
                  href="#code"
                  className="chip-glow inline-flex items-center gap-2.5 rounded-lg bg-amber px-6 py-3.5 font-display text-[13px] font-bold text-ink transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="m5.5 4-4 4 4 4M10.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Смотреть исходники
                </a>
                <a
                  href="#install"
                  className="inline-flex items-center gap-2.5 rounded-lg border border-line bg-panel px-6 py-3.5 font-display text-[13px] font-bold text-paper transition-colors duration-200 hover:border-phos/50 hover:text-phos"
                >
                  Быстрый старт
                </a>
              </div>
            </Reveal>

            <Reveal delay={340}>
              <div className="mt-9">
                <Equalizer />
              </div>
            </Reveal>
          </div>

          <Reveal delay={150} className="lg:pt-2">
            <Terminal reduced={reduced} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================= marquee ================= */

const ITEMS = [
  "wav → midi", "flac → musicxml", "mp3 → gp5", "torch · mps", "crepe-full · viterbi",
  "on 0.60 / off 0.35", "high-pass 32 Гц", "silence −60 дБ", "коридор 0.55 полутона",
  "диапазон E1–G4", "сетка 1/16", "строй E–A–D–G",
];

function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative mt-16 overflow-hidden border-y border-line bg-ink-2/70 py-3.5" aria-hidden="true">
      <div className="marquee-track flex w-max items-center whitespace-nowrap">
        {row.map((it, i) => (
          <span key={i} className="flex items-center font-mono text-[11.5px] font-medium uppercase tracking-[0.2em]">
            <span className={`px-6 ${i % 3 === 0 ? "text-amber/80" : i % 3 === 1 ? "text-dim" : "text-phos/70"}`}>
              {it}
            </span>
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="2" y="2" width="6" height="6" transform="rotate(45 5 5)" fill="none" stroke="#5d6d75" strokeWidth="1.2" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ================= pipeline ================= */

const icon = (path: ReactNode) => (
  <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    {path}
  </svg>
);

const ICONS = {
  wave: icon(
    <>
      <rect x="2.5" y="4.5" width="23" height="19" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 14h3l2-5 3 10 2.5-7 1.5 2h4" stroke="#f2a33c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  filter: icon(
    <>
      <path d="M4 8h20M4 14h20M4 20h20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="8" r="2.4" fill="#14100b" stroke="#43c9a2" strokeWidth="1.6" />
      <circle cx="18" cy="14" r="2.4" fill="#14100b" stroke="#43c9a2" strokeWidth="1.6" />
      <circle cx="8" cy="20" r="2.4" fill="#14100b" stroke="#43c9a2" strokeWidth="1.6" />
    </>
  ),
  chip: icon(
    <>
      <rect x="7" y="7" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 2.5v4.5M17 2.5v4.5M11 21v4.5M17 21v4.5M2.5 11H7M2.5 17H7M21 11h4.5M21 17h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.5 14h1.6l1-2.4 1.6 4.4 1-2h1.8" stroke="#f2a33c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  gate: icon(
    <>
      <path d="M3 20h4l3-9 4 9 3-6 2 3h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="3" y1="8" x2="25" y2="8" stroke="#f2a33c" strokeWidth="1.4" strokeDasharray="3 3" />
      <line x1="3" y1="15" x2="25" y2="15" stroke="#43c9a2" strokeWidth="1.4" strokeDasharray="3 3" />
    </>
  ),
  metro: icon(
    <>
      <path d="M10 3.5h8L21.5 23a1.6 1.6 0 0 1-1.6 2H8.1a1.6 1.6 0 0 1-1.6-2L10 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 19 19.5 8" stroke="#f2a33c" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="19.5" cy="8" r="2" fill="#f2a33c" />
      <path d="M9.5 19h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  sheets: icon(
    <>
      <path d="M8 3.5h9.5L21 7v14.5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-16a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M17 3.5V7.5H21" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 12.5h8M9.5 16h8M9.5 19.5h5" stroke="#43c9a2" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
};

const STAGES = [
  {
    num: "01", title: "Декодирование", engine: "soundfile · ffmpeg",
    desc: "wav и flac читает soundfile (libsndfile), mp3 — он же на libsndfile 1.1+ либо ffmpeg CLI. Без torchaudio.load — значит без torchcodec. Сигнал уходит в float-тензор.",
    tags: ["wav / flac / mp3", "fallback: ffmpeg"], icon: ICONS.wave,
  },
  {
    num: "02", title: "Предобработка + High-Pass", engine: "torchaudio.functional · CPU",
    desc: "Миксдаун в моно, ресемплинг до 16 kHz (Kaiser β≈14.8), затем HIGH-PASS 32 Гц (Баттерворт, Q=0.707): убирает сценический гул и постоянную составляющую, поднимая уверенность CREPE в полезных фреймах. Пик нормализуется до −1 dBFS.",
    tags: ["16 kHz", "HP 30–35 Гц", "−1 dBFS"], icon: ICONS.filter,
  },
  {
    num: "03", title: "Питч-трекинг CREPE", engine: "torchcrepe · MPS",
    desc: "CNN full (~24.4M параметров) поверх мел-спектра; декодирование — всегда Витерби (не argmax): сглаживает траекторию f0 и минимизирует октавные ошибки. Затем обнуление уверенности в тишине (Silence −60 дБ) и частотный гистерезис-коридор ~0.55 полутона. Чанки по 30 c, инференс — в subprocess с авто-откатом на CPU.",
    tags: ["viterbi", "silence −60 дБ", "коридор 0.55 пт", "чанки 30 c"], icon: ICONS.chip,
  },
  {
    num: "04", title: "Гистерезис + онсеты", engine: "триггер Шмитта · librosa",
    desc: "Двухпороговая сегментация: нота ВКЛ при уверенности ≥ 0.60 (не ловим касания струн), ВЫКЛ при < 0.35 (затухающий хвост держится до последнего). Звучащие сегменты режутся онсетами, высота — медиана центов.",
    tags: ["on 0.60", "off 0.35", "медиана центов"], icon: ICONS.gate,
  },
  {
    num: "05", title: "Ритм и динамика", engine: "beat_track + RMS",
    desc: "Темп — beat_track, приведение к 70–170 BPM (или --tempo). Старты и длительности снэпаются к сетке 1/16, velocity берётся из RMS первых фреймов атаки.",
    tags: ["авто-темп", "сетка 1/16", "velocity 30–120"], icon: ICONS.metro,
  },
  {
    num: "06", title: "Экспорт в три формата", engine: "mido · xml · PyGuitarPro",
    desc: "MIDI — дельта-событиями при 480 tpq; MusicXML — partwise с басовым ключом и tie-связками (UTF-8); GP5 — табулатура на строе E–A–D–G с минимальными ладами (latin-1).",
    tags: [".mid", ".musicxml", ".gp5"], icon: ICONS.sheets,
  },
];

function Pipeline() {
  return (
    <section id="pipeline" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="01 · Пайплайн"
          title="Шесть стадий от волны до табулатуры"
          lead="Тяжёлые вычисления (ресемплинг, high-pass, инференс CREPE, RMS) идут на Apple Silicon через MPS; librosa добирает онсеты и темп на CPU. Каждая стадия — отдельный модуль пакета."
        />
        <div className="relative mt-14">
          <svg className="absolute -left-8 bottom-10 top-2 hidden h-[calc(100%-3rem)] w-6 lg:block" aria-hidden="true">
            <line x1="11" y1="0" x2="11" y2="100%" stroke="#f2a33c" strokeWidth="1.4" className="dash-flow" opacity="0.5" />
          </svg>
          <ol className="space-y-5">
            {STAGES.map((s, i) => (
              <li key={s.num}>
                <Reveal delay={i * 70}>
                  <article className="card-lift group relative grid gap-5 rounded-xl border border-line bg-panel p-6 sm:grid-cols-[72px_1fr] sm:p-7">
                    <div className="flex items-center gap-5 sm:flex-col sm:items-start sm:gap-3">
                      <span className="font-display text-[34px] font-black leading-none text-amber/25 transition-colors duration-300 group-hover:text-amber/60">
                        {s.num}
                      </span>
                      <span className="text-dim transition-colors duration-300 group-hover:text-amber">{s.icon}</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <h3 className="font-display text-[17px] font-bold text-paper sm:text-[19px]">{s.title}</h3>
                        <span className="font-mono text-[11.5px] font-medium text-phos/80">{s.engine}</span>
                      </div>
                      <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-dim">{s.desc}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {s.tags.map((t) => (
                          <span key={t} className="rounded border border-line/80 bg-ink-2 px-2.5 py-1 font-mono text-[10.5px] text-faint">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ================= hysteresis ================= */

function HysteresisChart() {
  // Кривая уверенности: атака -> плато -> затухание; вторая атака ниже 0.6.
  // Нота держится, пока кривая выше 0.35 (нижний порог).
  return (
    <svg viewBox="0 0 640 220" className="w-full" aria-label="Диаграмма двухпороговой гистерезисной сегментации">
      {/* зоны порогов */}
      <rect x="0" y="20" width="640" height="58" fill="rgba(242,163,60,0.05)" />
      <rect x="0" y="78" width="640" height="66" fill="rgba(141,124,99,0.06)" />
      <rect x="0" y="144" width="640" height="76" fill="rgba(67,201,162,0.05)" />

      {/* линии порогов */}
      <line x1="0" x2="640" y1="78" y2="78" stroke="#f2a33c" strokeWidth="1.6" strokeDasharray="6 5" />
      <line x1="0" x2="640" y1="144" y2="144" stroke="#43c9a2" strokeWidth="1.6" strokeDasharray="6 5" />
      <text x="8" y="70" fill="#f2a33c" fontSize="11" fontFamily="JetBrains Mono, monospace">on 0.60 — активация ноты</text>
      <text x="8" y="160" fill="#43c9a2" fontSize="11" fontFamily="JetBrains Mono, monospace">off 0.35 — сброс ноты</text>

      {/* подсветка удерживаемой ноты */}
      <rect x="96" y="20" width="316" height="200" fill="rgba(242,163,60,0.08)" stroke="rgba(242,163,60,0.35)" strokeWidth="1" />
      <text x="106" y="36" fill="#f4ecdd" fontSize="11" fontFamily="JetBrains Mono, monospace" opacity="0.8">нота удерживается (0.35 ≤ conf)</text>

      {/* ось */}
      <line x1="0" x2="640" y1="200" y2="200" stroke="#3b2f21" strokeWidth="1" />

      {/* кривая уверенности */}
      <path
        className="trace-draw"
        d="M8 190 L80 186 L96 40 L120 30 L150 44 L190 36 L230 52 L270 74 L310 92 L350 110 L390 132 L412 152 L430 176 L470 184 L520 120 L540 100 L570 130 L600 170 L632 186"
        fill="none"
        stroke="#f4ecdd"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* маркеры вкл/выкл */}
      <circle cx="96" cy="40" r="5" fill="#f2a33c" />
      <circle cx="412" cy="152" r="5" fill="#43c9a2" />
      <circle cx="520" cy="120" r="4" fill="none" stroke="#f2a33c" strokeWidth="1.6" />
      <text x="500" y="100" fill="#c0b096" fontSize="10.5" fontFamily="JetBrains Mono, monospace">атака &lt; 0.6 —</text>
      <text x="500" y="113" fill="#c0b096" fontSize="10.5" fontFamily="JetBrains Mono, monospace">нота не началась</text>
    </svg>
  );
}

function Hysteresis() {
  return (
    <section id="hysteresis" className="scroll-mt-24 border-t border-line bg-ink-2/40 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="02 · Алгоритм выделения нот"
          title="Два порога вместо одного — нота дышит"
          lead="Один жёсткий порог либо рвёт затухающие ноты, либо ловит случайные касания струн. Гистерезис (триггер Шмитта) решает обе проблемы: разные пороги на включение и выключение."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal>
            <div className="card-lift h-full rounded-xl border border-line bg-panel p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-display text-[16px] font-bold text-paper">Кривая уверенности CREPE</h3>
                <span className="font-mono text-[10.5px] text-faint">notes.py · hysteresis_segments</span>
              </div>
              <div className="mt-6">
                <HysteresisChart />
              </div>
            </div>
          </Reveal>

          <div className="space-y-5">
            <Reveal delay={100}>
              <div className="card-lift rounded-xl border border-amber/30 bg-panel p-6">
                <div className="flex items-center gap-3">
                  <span className="font-display text-[26px] font-black text-amber">0.60</span>
                  <h4 className="font-display text-[14px] font-bold text-paper">Порог активации</h4>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-dim">
                  Нота начинается, только когда уверенность CREPE поднимается выше 0.60.
                  Лёгкие касания струн, приглушения и шум не дотягивают до порога —
                  ложных срабатываний нет.
                </p>
              </div>
            </Reveal>

            <Reveal delay={180}>
              <div className="card-lift rounded-xl border border-phos/30 bg-panel p-6">
                <div className="flex items-center gap-3">
                  <span className="font-display text-[26px] font-black text-phos">0.35</span>
                  <h4 className="font-display text-[14px] font-bold text-paper">Порог сброса</h4>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-dim">
                  Once начавшись, нота «держится», пока уверенность не упадёт ниже 0.35.
                  Затухающий хвост (conf 0.4–0.6) продолжается, а не обрывается —
                  длинные ноты записываются целиком.
                </p>
              </div>
            </Reveal>

            <Reveal delay={260}>
              <div className="rounded-xl border border-line bg-panel p-6">
                <h4 className="font-display text-[14px] font-bold text-paper">+ High-pass 32 Гц</h4>
                <p className="mt-3 text-[13.5px] leading-relaxed text-dim">
                  Перед CREPE сигнал проходит биквад-фильтр Баттерворта (срез 30–35 Гц,
                  Q=0.707). Гул и рокот ниже E1≈41 Гц убираются — нейросеть увереннее в
                  полезных фреймах, кривая уверенности поднимается выше порога активации.
                </p>
                <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-ink-2 px-4 py-3">
                  <pre className="font-mono text-[11.5px] leading-relaxed text-phos">
{`AF.highpass_biquad(x, 16000,
    cutoff_freq=32.0, Q=0.707)`}
                  </pre>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        <Reveal delay={80}>
          <div className="mt-8 rounded-xl border border-line bg-ink-2/60 p-6 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-[15px] font-bold text-paper">Три слоя защиты высоты</h3>
              <span className="font-mono text-[10.5px] text-faint">pitch.py · до квантования в MIDI</span>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />
                  <h4 className="font-mono text-[12px] font-bold uppercase tracking-wider text-amber">Витерби</h4>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-dim">
                  Декодирование — всегда Витерби, не argmax: сглаживает траекторию f0
                  и минимизирует «октавные ошибки» — суб-бас не прыгает на октаву вверх.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-phos" aria-hidden="true" />
                  <h4 className="font-mono text-[12px] font-bold uppercase tracking-wider text-phos">Тишина −60 дБ</h4>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-dim">
                  torchcrepe.threshold.Silence (A-взвешенно) обнуляет уверенность в паузах
                  + numpy-страховка по RMS. Фантомные ноты в тишине исчезают.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-paper" aria-hidden="true" />
                  <h4 className="font-mono text-[12px] font-bold uppercase tracking-wider text-paper">Коридор 0.55 пт</h4>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-dim">
                  Частотный гистерезис: пока высота не ушла за ~0.55 полутона, она удерживается.
                  Вибрато и фазовые искажения не дробят ноту на полутоновые скачки.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["Звучащие сегменты", "гистерезис даёт грубые интервалы «звучит/не звучит» с удержанием хвоста"],
              ["Разрезание онсетами", "librosa onset_detect делит сегмент — повторные атаки той же высоты не сливаются"],
              ["Медиана центов", "высота ноты — медиана по кадрам с conf ≥ 0.35; устойчива к вибрато"],
            ].map(([t, d], i) => (
              <div key={t} className="card-lift rounded-xl border border-line bg-panel p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-md border border-amber/40 font-mono text-[12px] font-bold text-amber">
                    {i + 1}
                  </span>
                  <h4 className="font-display text-[13.5px] font-bold text-paper">{t}</h4>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-dim">{d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= formats ================= */

const ARTIFACTS = [
  {
    ext: ".mid", lib: "mido", title: "Standard MIDI File", accent: "text-amber",
    desc: "Один трек, 480 тиков в четверти, meta-темп, program 34 (Electric Bass, pick). note_on/note_off — дельта-событиями; название — транслитерацией в latin-1.",
    opens: ["любая DAW", "MuseScore", "Logic / Ableton"],
  },
  {
    ext: ".musicxml", lib: "xml.etree", title: "MusicXML partwise", accent: "text-phos",
    desc: "Басовый ключ (F, линейка 4), divisions = 4, размер 4/4, metronome-темп. Ноты длиннее такта разбиваются tie-связками. UTF-8 — кириллица в названии сохраняется.",
    opens: ["MuseScore", "Dorico", "Finale"],
  },
  {
    ext: ".gp5", lib: "PyGuitarPro", title: "Guitar Pro 5", accent: "text-amber",
    desc: "Трек «Bass» со строем E1–A1–D2–G2. Для каждой ноты выбирается минимальный лад (0–24), паузы достраивают такт до 4/4. Темп и название — в заголовке партитуры (latin-1).",
    opens: ["Guitar Pro", "TuxGuitar", "alphaTab"],
  },
];

function Formats() {
  return (
    <section id="formats" className="scroll-mt-24 border-t border-line py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="04 · Артефакты"
          title="Три файла на выходе — и что внутри каждого"
          lead="Имя файла наследуется от исходника: take.wav даёт take.mid, take.musicxml и take.gp5 в каталоге --out."
        />
        <div className="mt-14 space-y-4">
          {ARTIFACTS.map((a, i) => (
            <Reveal key={a.ext} delay={i * 90}>
              <article className="card-lift group grid items-center gap-6 rounded-xl border border-line bg-panel p-6 md:grid-cols-[150px_1fr] md:p-7">
                <div>
                  <p className={`font-display text-[30px] font-black leading-none tracking-tight ${a.accent}`}>{a.ext}</p>
                  <p className="mt-2 inline-block rounded border border-line px-2 py-0.5 font-mono text-[10.5px] text-faint">{a.lib}</p>
                </div>
                <div>
                  <h3 className="font-display text-[16px] font-bold text-paper">{a.title}</h3>
                  <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-dim">{a.desc}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-faint">
                    <span className="text-phos/70">открывается:</span>
                    {a.opens.map((o) => (
                      <span key={o} className="rounded bg-ink-2 px-2 py-0.5">{o}</span>
                    ))}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= install ================= */

function Install() {
  return (
    <section id="install" className="scroll-mt-24 border-t border-line bg-ink-2/40 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="05 · Установка"
          title="Пять команд — и пакет транскрибирует"
          lead="Скачайте папку bass2tabs/ (настоящие .py-файлы), положите её в корень проекта и выполните команды ниже. Python 3.11+ обязателен: на 3.10 не ставится исправленная scipy."
        />
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <Reveal>
            <ol className="space-y-4">
              {[
                { t: "Системные зависимости", c: "brew install ffmpeg python@3.12" },
                { t: "Виртуальное окружение", c: "python3.12 -m venv .venv && source .venv/bin/activate" },
                { t: "Зависимости Python", c: "pip install -r requirements.txt" },
                { t: "Регистрация пакета", c: "pip install -e ." },
                { t: "Диагностика MPS", c: "bass2tabs --check" },
              ].map((s, i) => (
                <li key={s.t} className="card-lift rounded-xl border border-line bg-panel p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-amber/40 font-mono text-[12px] font-bold text-amber">
                      {i + 1}
                    </span>
                    <h3 className="font-display text-[14px] font-bold text-paper">{s.t}</h3>
                  </div>
                  <div className="mt-3">
                    <Command cmd={s.c} />
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={120}>
            <div className="space-y-5">
              <div className="rounded-xl border border-line bg-panel p-6">
                <h3 className="font-display text-[15px] font-bold text-paper">Первый прогон</h3>
                <div className="mt-4">
                  <Command
                    cmd="bass2tabs take.wav -o out --formats midi,musicxml,gp5"
                    note="на выходе: out/take.mid, out/take.musicxml, out/take.gp5"
                  />
                </div>
                <div className="mt-4">
                  <Command
                    cmd="bass2tabs take.wav --on-thr 0.6 --off-thr 0.35 --highpass 32"
                    note="гистерезис и high-pass уже по умолчанию — показаны явно для наглядности"
                  />
                </div>
                <div className="mt-4">
                  <Command
                    cmd="bass2tabs ~/Music/bass-takes -o out -r"
                    note="папка вместо файла: все wav/flac/mp3 внутри (и во вложенных каталогах с -r), каждый — в свой .mid/.musicxml/.gp5; сбой одного файла не останавливает пакет"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-line bg-panel p-6">
                <h3 className="font-display text-[15px] font-bold text-paper">Ключевые флаги</h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full font-mono text-[12px]">
                    <thead>
                      <tr className="text-left text-[10.5px] uppercase tracking-wider text-faint">
                        <th className="pb-2 pr-4">флаг</th>
                        <th className="pb-2 pr-4">по умолч.</th>
                        <th className="pb-2">смысл</th>
                      </tr>
                    </thead>
                    <tbody className="text-dim">
                      {[
                        ["--on-thr", "0.60", "порог активации ноты"],
                        ["--off-thr", "0.35", "порог сброса ноты"],
                        ["--highpass", "32", "срез HP, Гц (0 = выкл)"],
                        ["--model", "full", "CREPE: full / tiny"],
                        ["--batch", "авто", "64 mps / 2048 cpu"],
                        ["--tempo", "авто", "фиксированный BPM"],
                        ["--grid", "16", "сетка квантизации"],
                        ["--device", "auto", "auto/mps/cuda/cpu"],
                        ["-r", "выкл", "папка: и вложенные каталоги"],
                      ].map(([f, d, m]) => (
                        <tr key={f} className="border-t border-line/60">
                          <td className="py-2 pr-4 text-amber">{f}</td>
                          <td className="py-2 pr-4 text-phos">{d}</td>
                          <td className="py-2">{m}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================= faq ================= */

const FAQ = [
  {
    q: "Где лежат исходники и как их скачать?",
    a: "Все 14 файлов — настоящие .py/.txt/.toml/.md-файлы в папке public/bass2tabs/ репозитория. Они отдаются статикой без JS-рендера: в разделе «Исходники» у каждого файла есть прямая ссылка «Скачать», работает даже при отключённом JavaScript. Соберите структуру bass2tabs/bass2tabs/… как показано в README — и пакет готов.",
  },
  {
    q: "Почему два порога, а не один?",
    a: "Один порог — это компромисс: ниже — ловит касания струн, выше — рвёт затухающие ноты. Гистерезис разводит эти задачи: нота ВКЛЮЧАЕТСЯ при уверенности ≥ 0.60 (строгий вход против ложных срабатываний) и ВЫКЛЮЧАЕТСЯ только при < 0.35 (мягкий выход, хвост держится). Интервал 0.35–0.60 — зона удержания. Настройка — флагами --on-thr и --off-thr.",
  },
  {
    q: "Зачем high-pass перед CREPE, если CREPE и так знает диапазон?",
    a: "Сценический гул, рокот и постоянная составляющая (всё ниже ~35 Гц) снижают периодичность, которую оценивает CREPE, — уверенность в полезных фреймах падает и может не дотянуть до порога активации. Биквад-фильтр Баттерворта на 32 Гц (Q=0.707) убирает этот мусор до инференса, и кривая уверенности поднимается. Срез — флаг --highpass (30–35 Гц, 0 = выключить).",
  },
  {
    q: "«No module named bass2tabs» — Python не видит пакет",
    a: "python -m bass2tabs ищет каталог bass2tabs/ с __init__.py в текущей директории либо среди установленных пакетов. Быстрое решение — запускать из корня проекта (где лежит bass2tabs/bass2tabs/__init__.py). Кардинальное — pip install -e . в корне: пакет зарегистрируется в venv, и команда bass2tabs будет работать откуда угодно.",
  },
  {
    q: "«Failed to allocate IOGPUDeviceShmem» и zsh: abort",
    a: "Падает не Python, а Metal-драйвер: он abort'ит крупные выделения общей GPU-памяти (SIGABRT), перехватить который try/except нельзя. bass2tabs защищён с двух сторон: весь DSP — на CPU (первое GPU-выделение происходит только в CREPE), а сам инференс — в дочернем процессе, и при его гибели прогон автоматически повторяется на CPU. Дополнительно: чанки по 30 c, батч 64, PYTORCH_ENABLE_MPS_FALLBACK=1. Снизить шанс аборта: --batch 32, закрыть GPU-прожорливые приложения. Гарантированный обход — --device cpu.",
  },
  {
    q: "Ноты сливаются или, наоборот, дробятся — что крутить?",
    a: "Сливаются повторные атаки одной высоты — проверьте, что онсеты включены (они всегда включены и режут гистерезисные сегменты). Дробятся затухающие ноты — понизьте --off-thr (например, до 0.3) или --on-thr (до 0.5). Много ложных нот от касаний — поднимите --on-thr до 0.65–0.7. Слишком короткие обрывки — поднимите --min-duration.",
  },
  {
    q: "Обновил файл, а ошибка в логе точно такая же — что не так?",
    a: "Сравните текст сообщения: если в логе «! MPS-процесс погиб» и следом ZeroDivisionError — у вас старая версия pitch.py. В новой внутренние ошибки воркера печатаются как «! ошибка внутри MPS-процесса: …», а hop=0 (причина деления на ноль) исправлен: --hop-ms снэпается вверх до 160. Обновите bass2tabs/pitch.py заново из «Исходников» (при кэше браузера — Cmd+Shift+R) или примените одноразовую заплату из раздела «Диагностика» README. Проверка: grep -n \"hop = max(160\" bass2tabs/pitch.py — строка должна найтись.",
  },
  {
    q: "Можно скормить сразу папку с записями, а не один файл?",
    a: "Да: bass2tabs ~/Music/bass-takes -o out обработает все wav/flac/mp3 в папке (флаг -r добавит вложенные каталоги). Каждый файл получает собственный набор .mid/.musicxml/.gp5 с именем по имени исходника; в конце печатается сводка «N/M файлов · ноты · время». Ошибка на одном файле не прерывает пакет — он помечается «!!» в сводке, остальные доделываются.",
  },
  {
    q: "Откуда берётся защита от фантомных нот в паузах и дробления нот вибрато?",
    a: "Три слоя в pitch.py. (1) Декодирование — всегда Витерби, а не argmax: он математически сглаживает траекторию частоты и минимизирует «октавные ошибки» (суб-бас не прыгает на октаву). (2) Перед гистерезисом уверенность обнуляется в абсолютной тишине — torchcrepe.threshold.Silence (A-взвешенно, −60 дБ) плюс страховочный numpy-слой по RMS: фантомные ноты в паузах исчезают. (3) Частотный гистерезис — коридор ~0.55 полутона: пока высота не ушла за коридор, она удерживается, поэтому микро-вибрато и фазовые искажения низких частот не дробят одну ноту на быстрые полутоновые скачки.",
  },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="scroll-mt-24 border-t border-line py-24 sm:py-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <SectionHeading kicker="06 · FAQ" title="Вопросы после первого прогона" />
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
                    <span className="font-display text-[14.5px] font-bold text-paper sm:text-[15.5px]">{item.q}</span>
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

/* ================= app ================= */

export default function App() {
  return (
    <div className="bg-stage noise relative min-h-screen">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden="true" />
      <Nav />
      <main className="relative">
        <Hero />
        <Marquee />
        <Pipeline />
        <Hysteresis />
        <Formats />
        <CodeBrowser />
        <Install />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
