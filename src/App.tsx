import { useEffect, useState, type ReactNode } from "react";
import { usePrefersReducedMotion, useScramble } from "./hooks";
import { Command, CopyButton, Footer, Nav, Reveal, SectionHeading } from "./ui";
import { CodeBrowser } from "./components/CodeBrowser";

/* ================= terminal ================= */

type TermLine = { text: string; cls: string; pause?: number };

const LINES: TermLine[] = [
  { text: "$ bass2tabs take.wav --formats midi,musicxml,gp5", cls: "text-paper", pause: 500 },
  { text: "torch 2.13.0 · python 3.12 · macOS 27.0 · arm64", cls: "text-faint", pause: 140 },
  { text: "устройство: mps · выделено 0.0 MiB на старте", cls: "text-faint", pause: 260 },
  { text: "· загружено take.wav: 3:47 · 44100 Hz -> 16 kHz mono", cls: "text-dim", pause: 300 },
  { text: "· питч-трекинг (CREPE full на mps)…", cls: "text-dim", pause: 200 },
  { text: "  CREPE full · чанк 7/7 [██████████████] 100% · 6.3 c", cls: "text-phos", pause: 300 },
  { text: "· сегментация: 196 нот · темп 118 BPM · сетка 1/16", cls: "text-dim", pause: 300 },
  { text: "· экспорт (midi, musicxml, gp5)…", cls: "text-dim", pause: 200 },
  { text: "  ok out/take.mid        (4.2 KB)", cls: "text-phos", pause: 130 },
  { text: "  ok out/take.musicxml   (17.9 KB)", cls: "text-phos", pause: 130 },
  { text: "  ok out/take.gp5        (21.4 KB · струны E–A–D–G)", cls: "text-phos", pause: 600 },
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
      t = window.setTimeout(() => setCh((c) => c + 2), 13);
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

/* ================= equalizer card ================= */

function EqualizerCard({ reduced }: { reduced: boolean }) {
  const bars = [
    0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.75, 0.5, 0.85, 0.6, 0.4, 0.7, 0.95, 0.55, 0.8, 0.45,
    0.65, 0.9, 0.5, 0.75, 0.35, 0.6, 0.85, 0.5, 0.7, 0.4, 0.9, 0.55, 0.65, 0.45, 0.8, 0.6,
  ];
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-ink-2/95">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-mono text-[11px] text-dim">f0-контур · CREPE-full · 8 ms</span>
        <span className="font-mono text-[11px] text-faint">E1 – G4</span>
      </div>
      <div className="relative flex h-36 items-end gap-[3px] px-3 pb-3 pt-6">
        {bars.map((h, i) => (
          <div
            key={i}
            className="eq-bar flex-1 rounded-t-sm"
            style={{
              height: `${h * 100}%`,
              animationDelay: `${(i % 8) * 0.09}s`,
              animationDuration: `${0.9 + (i % 5) * 0.12}s`,
              background:
                h > 0.8
                  ? "linear-gradient(to top, rgba(217,127,30,0.9), rgba(242,163,60,0.9))"
                  : h > 0.55
                    ? "linear-gradient(to top, rgba(31,143,112,0.8), rgba(67,201,162,0.8))"
                    : "linear-gradient(to top, rgba(61,50,36,0.9), rgba(141,124,99,0.7))",
            }}
          />
        ))}
        {!reduced && (
          <div
            className="scan-line pointer-events-none absolute inset-y-2 w-px bg-amber/80"
            style={{ boxShadow: "0 0 12px rgba(242,163,60,0.8)" }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

/* ================= hero ================= */

const BADGES = ["torch ≥ 2.1", "MPS", "CREPE-full", "MIDI", "MusicXML", "GP5"];

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

            <h1 className="mt-7 font-display text-[44px] font-black leading-[0.98] tracking-tight text-paper sm:text-[64px] lg:text-[72px]">
              <span className="whitespace-pre">{title}</span>
              <span className="mt-2 block text-[22px] font-medium leading-snug text-dim sm:text-[26px]">
                партия баса из аудио —<br />в <span className="text-amber">MIDI</span>,{" "}
                <span className="text-amber">MusicXML</span> и <span className="text-amber">GP5</span>
              </span>
            </h1>

            <Reveal delay={120}>
              <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-dim">
                Python-приложение для транскрибации записи бас-гитары
                (wav&nbsp;/&nbsp;flac&nbsp;/&nbsp;mp3). Питч-трекинг CREPE исполняется на GPU через{" "}
                <span className="font-mono text-[14px] text-phos">MPS</span>, онсеты и темп считает
                librosa, экспорт — в три нотных формата сразу. Исходники — настоящие .py-файлы в
                репозитории, без JS-рендера.
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
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </Reveal>

            <Reveal delay={360}>
              <dl className="mt-10 grid max-w-md grid-cols-3 divide-x divide-line border-y border-line">
                {[
                  { v: "3", l: "формата на выходе" },
                  { v: "14", l: "файлов в пакете" },
                  { v: "≈700", l: "строк Python" },
                ].map((s) => (
                  <div key={s.l} className="flex flex-col px-4 py-4 first:pl-0">
                    <dd className="font-display text-[26px] font-bold leading-none text-paper">{s.v}</dd>
                    <dt className="mt-1 font-mono text-[10.5px] leading-tight text-faint">{s.l}</dt>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal delay={150} className="lg:pt-2">
            <Terminal reduced={reduced} />
            <div className="mt-4">
              <EqualizerCard reduced={reduced} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================= marquee ================= */

const ITEMS = [
  "wav → midi", "flac → musicxml", "mp3 → gp5", "torch · mps", "crepe-full · viterbi",
  "диапазон E1–G4", "сетка 1/16", "строй E–A–D–G", "onset backtrack", "480 tpq",
  "velocity из rms", "авто-темп",
];

function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative mt-20 overflow-hidden border-y border-line bg-ink-2/70 py-3.5" aria-hidden="true">
      <div className="marquee-track flex w-max items-center whitespace-nowrap">
        {row.map((it, i) => (
          <span key={i} className="flex items-center font-mono text-[11.5px] font-medium uppercase tracking-[0.2em]">
            <span className={`px-6 ${i % 3 === 0 ? "text-amber/80" : i % 3 === 1 ? "text-dim" : "text-phos/70"}`}>
              {it}
            </span>
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="2" y="2" width="6" height="6" transform="rotate(45 5 5)" fill="none" stroke="#8d7c63" strokeWidth="1.2" />
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
  segment: icon(
    <>
      <path d="M3 20h5M11 20h6M20 20h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="12" r="2.2" stroke="#43c9a2" strokeWidth="1.6" />
      <circle cx="14" cy="7" r="2.2" stroke="#f2a33c" strokeWidth="1.6" />
      <circle cx="20" cy="11" r="2.2" stroke="#43c9a2" strokeWidth="1.6" />
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

type Stage = { num: string; title: string; engine: string; desc: string; tags: string[]; icon: ReactNode };

const STAGES: Stage[] = [
  {
    num: "01", title: "Декодирование", engine: "soundfile · ffmpeg",
    desc: "wav и flac читает soundfile (libsndfile), mp3 — он же на libsndfile 1.1+ либо ffmpeg CLI. Без torchaudio.load и torchcodec. Сигнал сразу превращается в тензор.",
    tags: ["wav / flac / mp3", "fallback: ffmpeg"], icon: ICONS.wave,
  },
  {
    num: "02", title: "Предобработка на CPU", engine: "torchaudio.functional",
    desc: "Миксдаун в моно, ресемплинг до 16 kHz (Kaiser), biquad-highpass 30 Гц против сценического гула, нормализация пика до −1 dBFS. Всё на CPU — первое GPU-выделение будет уже в CREPE.",
    tags: ["16 kHz", "highpass 30 Hz", "−1 dBFS"], icon: ICONS.filter,
  },
  {
    num: "03", title: "Питч-трекинг CREPE", engine: "torchcrepe · MPS",
    desc: "CNN full (~24.4M параметров) поверх сырой волны, декодер Витерби собирает гладкий контур f0, hop 8 мс. Трек идёт чанками по 30 с в дочернем процессе: abort Metal-драйвера убивает только его, прогон повторяется на CPU.",
    tags: ["model=full", "viterbi", "чанки 30 c", "subprocess"], icon: ICONS.chip,
  },
  {
    num: "04", title: "Онсеты и сегментация", engine: "librosa",
    desc: "onset_detect с backtracking находит атаки, контур режется на сегменты. Медиана центов сегмента округляется до полутона: midi = cents/100 + 3.4868. Фильтр диапазона E1–G4.",
    tags: ["backtrack", "медиана центов", "E1–G4"], icon: ICONS.segment,
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
          lead="Каждая стадия — отдельный модуль пакета. Тяжёлые вычисления (ресемплинг, фильтрация, RMS) — на CPU; инференс CREPE — на Apple Silicon через MPS, с защитой от драйверных abort'ов."
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

/* ================= formats ================= */

function GpViz() {
  return (
    <pre className="font-mono text-[11px] leading-[1.5] text-dim" aria-hidden="true">
{`G|-----------------|
D|-------5---7-----|
A|---3-----------5-|
E|0---------------|`}
    </pre>
  );
}

type Artifact = { ext: string; lib: string; title: string; desc: string; opens: string[]; accent: string; viz: ReactNode };

const ARTIFACTS: Artifact[] = [
  {
    ext: ".mid", lib: "mido", title: "Standard MIDI File",
    desc: "Один трек, 480 тиков в четверти, meta-темп из авто-оценки, program 34 (Electric Bass, pick). note_on/note_off — дельта-событиями. Имя трека — через транслитерацию в latin-1.",
    opens: ["любая DAW", "MuseScore", "Logic / Ableton"], accent: "text-amber",
    viz: (
      <svg width="132" height="76" viewBox="0 0 132 76" aria-hidden="true" className="opacity-90">
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <line key={r} x1="0" x2="132" y1={8 + r * 12} y2={8 + r * 12} stroke="#3b2f21" strokeWidth="1" />
        ))}
        <rect x="6" y="50" width="18" height="8" rx="2" fill="#f2a33c" />
        <rect x="28" y="38" width="12" height="8" rx="2" fill="#f2a33c" opacity="0.85" />
        <rect x="46" y="44" width="22" height="8" rx="2" fill="#f2a33c" />
        <rect x="72" y="26" width="14" height="8" rx="2" fill="#43c9a2" />
        <rect x="92" y="38" width="10" height="8" rx="2" fill="#f2a33c" opacity="0.7" />
        <rect x="106" y="50" width="20" height="8" rx="2" fill="#f2a33c" />
      </svg>
    ),
  },
  {
    ext: ".musicxml", lib: "xml.etree", title: "MusicXML partwise",
    desc: "Басовый ключ (F, линейка 4), divisions = 4, размер 4/4, metronome-темп. Ноты длиннее такта разбиваются tie-связками. XML в UTF-8 — кириллица в названии сохраняется как есть.",
    opens: ["MuseScore", "Dorico", "Finale"], accent: "text-phos",
    viz: (
      <svg width="132" height="76" viewBox="0 0 132 76" aria-hidden="true" className="opacity-90">
        {[22, 32, 42, 52, 62].map((y) => (
          <line key={y} x1="2" x2="130" y1={y} y2={y} stroke="#8d7c63" strokeWidth="1.2" />
        ))}
        <ellipse cx="46" cy="47" rx="5" ry="3.8" transform="rotate(-18 46 47)" fill="#f2a33c" />
        <line x1="50.6" y1="45.5" x2="50.6" y2="20" stroke="#f2a33c" strokeWidth="1.6" />
        <ellipse cx="74" cy="42" rx="5" ry="3.8" transform="rotate(-18 74 42)" fill="#f2a33c" />
        <line x1="78.6" y1="40.5" x2="78.6" y2="15" stroke="#f2a33c" strokeWidth="1.6" />
        <line x1="50.6" y1="20" x2="78.6" y2="15" stroke="#f2a33c" strokeWidth="2.4" />
        <ellipse cx="104" cy="52" rx="5" ry="3.8" transform="rotate(-18 104 52)" fill="#43c9a2" />
        <line x1="108.6" y1="50.5" x2="108.6" y2="26" stroke="#43c9a2" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    ext: ".gp5", lib: "PyGuitarPro", title: "Guitar Pro 5",
    desc: "Трек «Bass» со строем E1–A1–D2–G2. Для каждой ноты выбирается минимальный лад (0–24), паузы достраивают такт до 4/4. Темп и название — в заголовке партитуры (latin-1).",
    opens: ["Guitar Pro", "TuxGuitar", "alphaTab"], accent: "text-amber",
    viz: <GpViz />,
  },
];

function Formats() {
  return (
    <section id="formats" className="scroll-mt-24 border-t border-line bg-ink-2/40 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="02 · Артефакты"
          title="Три файла на выходе — и что внутри каждого"
          lead="Имя файла наследуется от исходника: take.wav даёт take.mid, take.musicxml и take.gp5 в каталоге --out."
        />
        <div className="mt-14 space-y-4">
          {ARTIFACTS.map((a, i) => (
            <Reveal key={a.ext} delay={i * 90}>
              <article className="card-lift group grid items-center gap-6 rounded-xl border border-line bg-panel p-6 md:grid-cols-[150px_1fr_auto] md:p-7">
                <div>
                  <p className={`font-display text-[30px] font-black leading-none tracking-tight ${a.accent}`}>{a.ext}</p>
                  <p className="mt-2 inline-block rounded border border-line px-2 py-0.5 font-mono text-[10.5px] text-faint">{a.lib}</p>
                </div>
                <div>
                  <h3 className="font-display text-[16px] font-bold text-paper">{a.title}</h3>
                  <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-dim">{a.desc}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-faint">
                    <span className="text-phos/70">открывается:</span>
                    {a.opens.map((o) => (
                      <span key={o} className="rounded bg-ink-2 px-2 py-0.5">{o}</span>
                    ))}
                  </div>
                </div>
                <div className="hidden shrink-0 rounded-lg border border-line/70 bg-ink-2 px-4 py-3 transition-colors duration-300 group-hover:border-amber/30 md:block">
                  {a.viz}
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

const INSTALL_STEPS = [
  { title: "Зависимости системы", body: "ffmpeg нужен для чтения mp3 (wav/flac читает libsndfile)." },
  { title: "Виртуальное окружение", body: "Из-за бага scipy на macOS 26.3+ берите Python 3.11+ (brew install python@3.12)." },
  { title: "Пакеты Python", body: "Тяжелеет на torch (~60 МБ wheel для arm64) и librosa. scipy среди прямых зависимостей нет — фильтры на чистом numpy." },
  { title: "Регистрация пакета", body: "pip install -e . — штатная защита от «No module named bass2tabs»: команда работает из любой директории." },
  { title: "Диагностика MPS", body: "Проверит версии torch/torchcrepe, доступность MPS и прогонит тестовый matmul на GPU." },
];

const INSTALL_CMDS = [
  "brew install ffmpeg",
  "python3 -m venv .venv && source .venv/bin/activate",
  "pip install -r requirements.txt",
  "pip install -e .",
  "bass2tabs --check",
];

function Install() {
  return (
    <section id="install" className="scroll-mt-24 border-t border-line py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="04 · Установка"
          title="Пять команд — и пакет транскрибирует"
          lead="Скачайте папку bass2tabs/ (реальные .py-файлы) и выполните команды ниже в её корне."
        />
        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal left>
            <ol className="space-y-6">
              {INSTALL_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber/40 bg-amber/10 font-display text-[13px] font-bold text-amber">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-display text-[14.5px] font-bold text-paper">{s.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-dim">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={120}>
            <div className="space-y-3">
              {INSTALL_CMDS.map((c) => (
                <Command key={c} cmd={c} />
              ))}
              <Command
                cmd='bass2tabs take.wav -o out --formats midi,musicxml,gp5'
                note="первый прогон: на выходе out/take.mid, out/take.musicxml, out/take.gp5"
              />
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
    q: "«No module named bass2tabs» — Python не видит пакет",
    a: "python -m bass2tabs ищет каталог bass2tabs/ с __init__.py в текущей директории либо среди установленных пакетов. Быстрое решение — запускать из корня проекта (где лежит bass2tabs/bass2tabs/__init__.py). Кардинальное — pip install -e . в корне: пакет зарегистрируется в venv, и команда bass2tabs будет работать откуда угодно.",
  },
  {
    q: "pip пишет «No matching distribution found for torch-mel-crepe»",
    a: "Пакет в PyPI называется torchcrepe — одним словом, без дефисов; имени torch-mel-crepe там никогда не было. В requirements.txt это учтено: pip install \"torchcrepe>=0.0.22\". Проверить можно командой bass2tabs --check.",
  },
  {
    q: "ImportError: dlopen _spropack.so — «__thread_bss … offset field is not zero»",
    a: "Это scipy ≤ 1.16 на macOS Tahoe 26.3+: ужесточённый dyld не пропускает битые Mach-O-секции (scipy/scipy#25635). Сам bass2tabs scipy не импортирует — фильтры на чистом numpy. Но транзитивно её грузят librosa/torchcrepe. Лечение — venv на Python 3.11+: туда встанет scipy ≥ 1.17 с корректными секциями. brew install python@3.12 && python3.12 -m venv .venv && pip install -r requirements.txt && pip install -e .",
  },
  {
    q: "«Failed to allocate IOGPUDeviceShmem» и zsh: abort",
    a: "Падает не Python, а Metal-драйвер: он abort'ит крупные выделения общей GPU-памяти (SIGABRT), перехватить который try/except нельзя. bass2tabs защищён с двух сторон: весь DSP — на CPU (первое GPU-выделение происходит только в CREPE), а сам инференс — в дочернем процессе, и при его гибели прогон автоматически повторяется на CPU. Дополнительно: чанки по 30 с, батч 64, PYTORCH_ENABLE_MPS_FALLBACK=1. Снизить шанс аборта: --batch 32, закрыть GPU-прожорливые приложения. Гарантированный обход — --device cpu.",
  },
  {
    q: "Кириллица в названии файла ломала экспорт — почему теперь нет?",
    a: "Форматы SMF (MIDI) и Guitar Pro 5 хранят текст в 8-битном latin-1 — UTF-8 туда не помещается. bass2tabs транслитерирует кириллицу в читаемую латиницу (модуль text.py: «Кейптаун» → «Keyptaun»), снимает диакритику, остаток заменяет на '?'. MusicXML — XML в UTF-8, там кириллица сохраняется как есть. Своё название — флаг --title.",
  },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="scroll-mt-24 border-t border-line bg-ink-2/40 py-24 sm:py-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <SectionHeading kicker="05 · FAQ" title="Вопросы, которые задают после первого прогона" />
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
    <div className="bg-stage noise relative min-h-screen overflow-x-clip">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[620px]" aria-hidden="true" />
      <Nav />
      <main className="relative">
        <Hero />
        <Marquee />
        <Pipeline />
        <Formats />
        <CodeBrowser />
        <Install />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
