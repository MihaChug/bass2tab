import type { ReactNode } from "react";
import { Reveal, SectionHeading } from "./Shell";

function MidiViz() {
  return (
    <svg width="132" height="76" viewBox="0 0 132 76" aria-hidden="true" className="opacity-90">
      {[0, 1, 2, 3, 4, 5].map((r) => (
        <line key={r} x1="0" x2="132" y1={8 + r * 12} y2={8 + r * 12} stroke="#263139" strokeWidth="1" />
      ))}
      {[22, 44, 66, 88, 110].map((x) => (
        <line key={x} x1={x} x2={x} y1="2" y2="74" stroke="#263139" strokeWidth="1" strokeDasharray="2 4" />
      ))}
      <rect x="6" y="50" width="18" height="8" rx="2" fill="#f2a33c" />
      <rect x="28" y="38" width="12" height="8" rx="2" fill="#f2a33c" opacity="0.85" />
      <rect x="46" y="44" width="22" height="8" rx="2" fill="#f2a33c" />
      <rect x="72" y="26" width="14" height="8" rx="2" fill="#43c9a2" />
      <rect x="92" y="38" width="10" height="8" rx="2" fill="#f2a33c" opacity="0.7" />
      <rect x="106" y="50" width="20" height="8" rx="2" fill="#f2a33c" />
    </svg>
  );
}

function XmlViz() {
  return (
    <svg width="132" height="76" viewBox="0 0 132 76" aria-hidden="true" className="opacity-90">
      {[22, 32, 42, 52, 62].map((y) => (
        <line key={y} x1="2" x2="130" y1={y} y2={y} stroke="#5d6d75" strokeWidth="1.2" />
      ))}
      <path d="M18 24c-3 8-3 20 0 36M18 24c6-2 12-2 16 0" stroke="#8fa0a8" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="18" cy="60" r="1.8" fill="#8fa0a8" />
      <ellipse cx="46" cy="47" rx="5" ry="3.8" transform="rotate(-18 46 47)" fill="#f2a33c" />
      <line x1="50.6" y1="45.5" x2="50.6" y2="20" stroke="#f2a33c" strokeWidth="1.6" />
      <ellipse cx="74" cy="42" rx="5" ry="3.8" transform="rotate(-18 74 42)" fill="#f2a33c" />
      <line x1="78.6" y1="40.5" x2="78.6" y2="15" stroke="#f2a33c" strokeWidth="1.6" />
      <line x1="50.6" y1="20" x2="78.6" y2="15" stroke="#f2a33c" strokeWidth="2.4" />
      <ellipse cx="104" cy="52" rx="5" ry="3.8" transform="rotate(-18 104 52)" fill="#43c9a2" />
      <line x1="108.6" y1="50.5" x2="108.6" y2="26" stroke="#43c9a2" strokeWidth="1.6" />
    </svg>
  );
}

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

type Artifact = {
  ext: string;
  lib: string;
  title: string;
  desc: string;
  opens: string[];
  viz: ReactNode;
  accent: string;
};

const ARTIFACTS: Artifact[] = [
  {
    ext: ".mid",
    lib: "mido",
    title: "Standard MIDI File",
    desc: "Один трек, 480 тиков в четверти, meta-темп из авто-оценки, program 34 (Electric Bass, pick). note_on/note_off — дельта-событиями, note_off всегда раньше при совпадении тиков.",
    opens: ["любая DAW", "MuseScore", "Logic / Ableton"],
    viz: <MidiViz />,
    accent: "text-amber",
  },
  {
    ext: ".musicxml",
    lib: "xml.etree",
    title: "MusicXML partwise",
    desc: "Басовый ключ (F, линейка 4), divisions = 4, размер 4/4, metronome-темп. Ноты длиннее такта разбиваются tie-связками. Пишется собственным writer'ом — без тяжёлых зависимостей.",
    opens: ["MuseScore", "Dorico", "Finale"],
    viz: <XmlViz />,
    accent: "text-phos",
  },
  {
    ext: ".gp5",
    lib: "guitarpro",
    title: "Guitar Pro 5",
    desc: "Трек «Bass» со строем E1–A1–D2–G2. Для каждой ноты выбирается минимальный лад (0–24), паузы достраивают такт до 4/4. Темп и название переносятся в заголовок партитуры.",
    opens: ["Guitar Pro", "TuxGuitar", "alphaTab"],
    viz: <GpViz />,
    accent: "text-amber",
  },
];

export function Formats() {
  return (
    <section id="formats" className="scroll-mt-24 border-t border-line bg-ink-2/40 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="02 · Артефакты"
          title="Три файла на выходе — и что внутри каждого"
          lead="Имя файла наследуется от исходника: roundabout.wav даёт roundabout.mid, roundabout.musicxml и roundabout.gp5 в каталоге --out."
        />

        <div className="mt-14 space-y-4">
          {ARTIFACTS.map((a, i) => (
            <Reveal key={a.ext} delay={i * 90}>
              <article className="card-lift group grid items-center gap-6 rounded-xl border border-line bg-panel p-6 md:grid-cols-[150px_1fr_auto] md:p-7">
                <div>
                  <p className={`font-display text-[30px] font-black leading-none tracking-tight ${a.accent}`}>
                    {a.ext}
                  </p>
                  <p className="mt-2 inline-block rounded border border-line px-2 py-0.5 font-mono text-[10.5px] text-faint">
                    {a.lib}
                  </p>
                </div>
                <div>
                  <h3 className="font-display text-[16px] font-bold text-paper">{a.title}</h3>
                  <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-dim">{a.desc}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-faint">
                    <span className="text-phos/70">открывается:</span>
                    {a.opens.map((o) => (
                      <span key={o} className="rounded bg-ink-2 px-2 py-0.5">
                        {o}
                      </span>
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
