import type { ReactNode } from "react";
import { Reveal, SectionHeading } from "./Shell";

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
      <circle cx="10" cy="8" r="2.4" fill="#0f1417" stroke="#43c9a2" strokeWidth="1.6" />
      <circle cx="18" cy="14" r="2.4" fill="#0f1417" stroke="#43c9a2" strokeWidth="1.6" />
      <circle cx="8" cy="20" r="2.4" fill="#0f1417" stroke="#43c9a2" strokeWidth="1.6" />
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
      <path d="M9.6 10.6 12.5 8.4M15.6 8.4l2.8 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 3" />
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

type Stage = {
  num: string;
  title: string;
  engine: string;
  desc: string;
  tags: string[];
  icon: ReactNode;
};

const STAGES: Stage[] = [
  {
    num: "01",
    title: "Декодирование",
    engine: "soundfile · ffmpeg",
    desc: "wav и flac читает soundfile (libsndfile), mp3 — он же на libsndfile 1.1+ либо ffmpeg CLI. Без torchaudio.load и torchcodec. Сигнал сразу превращается в float-тензор и уезжает на выбранное устройство.",
    tags: ["wav / flac / mp3", "fallback: ffmpeg"],
    icon: ICONS.wave,
  },
  {
    num: "02",
    title: "Предобработка на MPS",
    engine: "torchaudio.functional",
    desc: "Миксдаун в моно, ресемплинг до 16 kHz (Kaiser, β≈14.8), biquad-highpass 30 Гц против сценического гула и нормализация пика до −1 dBFS. Всё — тензорными операциями на GPU.",
    tags: ["16 kHz", "highpass 30 Hz", "−1 dBFS"],
    icon: ICONS.filter,
  },
  {
    num: "03",
    title: "Питч-трекинг CREPE",
    engine: "torchcrepe · MPS",
    desc: "CNN full (~24.4M параметров) поверх мел-спектра отдаёт распределение по 360 центовым бинам на фрейм. Декодер Витерби собирает гладкий контур f0, hop — 8 мс.",
    tags: ["model=full", "viterbi", "360 bins × 20¢"],
    icon: ICONS.chip,
  },
  {
    num: "04",
    title: "Онсеты и сегментация",
    engine: "librosa",
    desc: "onset_detect с backtracking находит атаки, контур режется на сегменты. Медиана центов сегмента округляется до полутона: midi = cents/100 + 3.4868. Фильтр диапазона E1–G4.",
    tags: ["backtrack", "медиана центов", "E1–G4"],
    icon: ICONS.segment,
  },
  {
    num: "05",
    title: "Ритм и динамика",
    engine: "beat_track + RMS",
    desc: "Темп оценивается по beat_track и приводится к 70–170 BPM (или задаётся флагом --tempo). Старты и длительности снэпаются к сетке 1/16, velocity берётся из RMS первых фреймов атаки.",
    tags: ["авто-темп", "сетка 1/16", "velocity 30–120"],
    icon: ICONS.metro,
  },
  {
    num: "06",
    title: "Экспорт в три формата",
    engine: "mido · xml.etree · PyGuitarPro",
    desc: "MIDI — дельта-событиями при 480 tpq; MusicXML — partwise с басовым ключом и tie-связками на границах тактов; GP5 — табулатура на строе E–A–D–G с минимальными ладами.",
    tags: [".mid", ".musicxml", ".gp5"],
    icon: ICONS.sheets,
  },
];

export function Pipeline() {
  return (
    <section id="pipeline" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="01 · Пайплайн"
          title="Шесть стадий от волны до табулатуры"
          lead="Каждая стадия — отдельный модуль пакета. Тяжёлые вычисления (ресемплинг, фильтрация, инференс CREPE, RMS) исполняются на Apple Silicon через MPS; librosa добирает онсеты и темп на CPU."
        />

        <div className="relative mt-14">
          {/* animated rail */}
          <svg
            className="absolute -left-8 bottom-10 top-2 hidden h-[calc(100%-3rem)] w-6 lg:block"
            aria-hidden="true"
          >
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
                      <span className="text-dim transition-colors duration-300 group-hover:text-amber">
                        {s.icon}
                      </span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <h3 className="font-display text-[17px] font-bold text-paper sm:text-[19px]">
                          {s.title}
                        </h3>
                        <span className="font-mono text-[11.5px] font-medium text-phos/80">{s.engine}</span>
                      </div>
                      <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-dim">{s.desc}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {s.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded border border-line/80 bg-ink-2 px-2.5 py-1 font-mono text-[10.5px] text-faint transition-colors duration-200 group-hover:border-line group-hover:text-dim"
                          >
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
