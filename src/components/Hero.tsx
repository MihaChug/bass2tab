import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion, useScramble } from "../hooks";
import { PROJECT_FILES } from "../data/projectFilesExports";
import { Reveal } from "./Shell";

/* ================= terminal ================= */

type TermLine = { text: string; cls: string; pause?: number };

const LINES: TermLine[] = [
  { text: "$ bass2tabs roundabout.wav --formats midi,musicxml,gp5", cls: "text-paper", pause: 500 },
  { text: "torch 2.5.1 · python 3.12 · macOS 14.5 · arm64", cls: "text-faint", pause: 140 },
  { text: "устройство: mps · выделено 0.0 MiB на старте", cls: "text-faint", pause: 260 },
  { text: "· загружено roundabout.wav: 3:47 · 44100 Hz → 16 kHz mono", cls: "text-dim", pause: 300 },
  { text: "· CREPE-full (mps): 28 240 фреймов · hop 8 ms · 6.3 c", cls: "text-phos", pause: 300 },
  { text: "· сегментация: 196 нот · темп 118 BPM · сетка 1/16", cls: "text-dim", pause: 300 },
  { text: "· итог: 196 нот · диапазон E1–G3 · 3:47 за 9.1 c", cls: "text-amber", pause: 420 },
  { text: "  ok out/roundabout.mid        (4.2 KB)", cls: "text-phos", pause: 130 },
  { text: "  ok out/roundabout.musicxml   (17.9 KB)", cls: "text-phos", pause: 130 },
  { text: "  ok out/roundabout.gp5        (21.4 KB · струны E–A–D–G)", cls: "text-phos", pause: 600 },
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
      t = window.setTimeout(() => setCh((c) => c + 2), 14);
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

/* ================= spectrogram ================= */

function Spectrogram({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.max(1, W * dpr);
      canvas.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const cellW = 3;
    const cellH = 5;
    const gap = 1;
    let t = 0;
    let raf = 0;

    const intensity = (i: number, j: number, tt: number) => {
      const row = j / 6;
      const band1 = Math.exp(-((row - (2.2 + 2.6 * Math.sin(tt * 0.21 + i * 0.011))) ** 2) * 1.5);
      const band2 =
        Math.exp(-((row - (5.5 + 1.9 * Math.sin(tt * 0.13 + i * 0.02 + 2))) ** 2) * 2.4) * 0.65;
      const burst = Math.max(0, Math.sin(i * 0.045 + tt * 0.72));
      const speckle = (Math.sin(i * 12.9898 + j * 78.233 + Math.floor(tt * 5) * 3.7) + 1) * 0.06;
      return Math.min(1, band1 * (0.5 + 0.5 * burst) + band2 * burst + speckle);
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cols = Math.ceil(W / (cellW + gap));
      const rows = Math.ceil(H / (cellH + gap));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const v = intensity(i, j, t);
          if (v < 0.15) continue;
          const y = H - (j + 1) * (cellH + gap);
          const a = Math.min(0.95, (v - 0.15) * 1.2);
          ctx.fillStyle =
            v > 0.72
              ? `rgba(242,163,60,${a})`
              : v > 0.4
                ? `rgba(99,214,178,${a * 0.85})`
                : `rgba(31,143,112,${a * 0.65})`;
          ctx.fillRect(i * (cellW + gap), y, cellW, cellH);
        }
      }
    };

    const loop = () => {
      t += 0.045;
      draw();
      raf = requestAnimationFrame(loop);
    };
    draw();
    if (!reduced) raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduced]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-ink-2/95">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-mono text-[11px] text-dim">f0-контур · CREPE-full · 8 ms</span>
        <span className="font-mono text-[11px] text-faint">02:14.6 / 03:47.0</span>
      </div>
      <div className="relative h-36">
        <canvas ref={ref} className="h-full w-full" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between py-2 pl-2 font-mono text-[9px] text-faint">
          <span>G4</span>
          <span>E2</span>
          <span>E1</span>
        </div>
        <div
          className="scan-line pointer-events-none absolute inset-y-0 w-px bg-amber/80"
          style={{ boxShadow: "0 0 12px rgba(242,163,60,0.8)" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/* ================= hero ================= */

const BADGES = ["torch ≥ 2.1", "MPS", "CREPE-full", "MIDI", "MusicXML", "GP5"];

export function Hero() {
  const reduced = usePrefersReducedMotion();
  const title = useScramble("bass2tabs");
  const loc = PROJECT_FILES.reduce((acc, f) => acc + f.code.split("\n").length, 0);

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
                партия баса из аудио —<br />
                в <span className="text-amber">MIDI</span>,{" "}
                <span className="text-amber">MusicXML</span> и{" "}
                <span className="text-amber">GP5</span>
              </span>
            </h1>

            <Reveal delay={120}>
              <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-dim">
                Python-приложение для транскрибации записи бас-гитары
                (wav&nbsp;/&nbsp;flac&nbsp;/&nbsp;mp3). Питч-трекинг CREPE исполняется на GPU
                через <span className="font-mono text-[14px] text-phos">MPS</span>, онсеты и
                темп считает librosa, экспорт — в три нотных формата сразу.
                Разделение микса не нужно: ожидается чистая басовая дорожка.
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
                  href="#setup"
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
                  { v: String(PROJECT_FILES.length), l: "файлов в пакете" },
                  { v: `≈${Math.round(loc / 10) * 10}`, l: "строк Python" },
                ].map((s) => (
                  <div key={s.l} className="flex flex-col px-4 py-4 first:pl-0">
                    <dd className="order-1 font-display text-[26px] font-bold leading-none text-paper">{s.v}</dd>
                    <dt className="order-2 mt-1.5 font-mono text-[10.5px] leading-tight text-faint">
                      {s.l}
                    </dt>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal delay={150} className="lg:pt-2">
            <Terminal reduced={reduced} />
            <div className="mt-4">
              <Spectrogram reduced={reduced} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================= marquee ================= */

const ITEMS = [
  "wav → midi",
  "flac → musicxml",
  "mp3 → gp5",
  "torch · mps",
  "crepe-full · viterbi",
  "диапазон E1–G4",
  "сетка 1/16",
  "строй E–A–D–G",
  "onset backtrack",
  "480 tpq",
  "velocity из rms",
  "авто-темп",
];

export function Marquee() {
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
              <rect x="2" y="2" width="6" height="6" transform="rotate(45 5 5)" fill="none" stroke="#5d6d75" strokeWidth="1.2" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
