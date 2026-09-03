import { useState, type ReactNode } from "react";
import { useReveal } from "./hooks";

/* ---------- reveal wrapper ---------- */
export function Reveal({
  children,
  className = "",
  delay = 0,
  left = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  left?: boolean;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${left ? "reveal-left" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/* ---------- logo ---------- */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="9" fill="#221b13" stroke="#3b2f21" />
      <line x1="8" y1="12" x2="32" y2="12" stroke="#8d7c63" strokeWidth="3.4" strokeLinecap="round" />
      <line x1="8" y1="18" x2="32" y2="18" stroke="#c0b096" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="8" y1="23.5" x2="32" y2="23.5" stroke="#c0b096" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="28" x2="32" y2="28" stroke="#8d7c63" strokeWidth="1" strokeLinecap="round" />
      <circle cx="14" cy="18" r="3.1" fill="#f2a33c" />
      <circle cx="25" cy="12" r="2.4" fill="#43c9a2" />
    </svg>
  );
}

/* ---------- section heading ---------- */
export function SectionHeading({
  kicker,
  title,
  lead,
  id,
}: {
  kicker: string;
  title: string;
  lead?: string;
  id?: string;
}) {
  return (
    <Reveal className="max-w-3xl">
      <div className="flex items-center gap-3">
        <span className="h-px w-10 bg-amber" aria-hidden="true" />
        <span
          id={id}
          className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-amber scroll-mt-28"
        >
          {kicker}
        </span>
      </div>
      <h2 className="mt-4 font-display text-[26px] font-bold leading-[1.12] text-paper sm:text-4xl">
        {title}
      </h2>
      {lead && <p className="mt-4 text-[15px] leading-relaxed text-dim">{lead}</p>}
    </Reveal>
  );
}

/* ---------- copy button ---------- */
export function CopyButton({
  text,
  label = "Копировать",
  copiedLabel = "Скопировано",
  compact = false,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border font-mono text-[11px] font-medium transition-colors duration-200 ${
        copied
          ? "border-phos/50 bg-phos/10 text-phos"
          : "border-line bg-panel-2 text-dim hover:border-amber/50 hover:text-amber"
      } ${compact ? "px-2.5 py-1.5" : "px-3.5 py-2"}`}
      aria-label={label}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2.5 8.5 6 12l7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
      <span className={compact ? "hidden sm:inline" : ""}>{copied ? copiedLabel : label}</span>
    </button>
  );
}

/* ---------- command block ---------- */
export function Command({ cmd, note }: { cmd: string; note?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-ink-2">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="font-mono text-[12px] text-paper">
          <span className="mr-2 select-none text-phos">$</span>
          {cmd}
        </span>
        <CopyButton text={cmd} compact />
      </div>
      {note && <p className="px-4 py-2.5 font-mono text-[11px] leading-relaxed text-faint">{note}</p>}
    </div>
  );
}

/* ---------- nav ---------- */
export const NAV_LINKS = [
  { href: "#pipeline", label: "Пайплайн" },
  { href: "#hysteresis", label: "Алгоритм" },
  { href: "#formats", label: "Форматы" },
  { href: "#code", label: "Исходники" },
  { href: "#install", label: "Установка" },
];

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/70 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-[15px] font-bold tracking-tight text-paper">
            bass<span className="text-amber">2</span>tabs
          </span>
          <span className="mt-0.5 hidden font-mono text-[10px] text-faint sm:inline">v0.1.0</span>
        </a>
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="link-sweep font-mono text-[12px] font-medium text-dim transition-colors hover:text-paper"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-phos opacity-50 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-phos" />
          </span>
          <span className="font-mono text-[11px] font-medium text-dim">MPS · готов</span>
        </div>
      </div>
    </header>
  );
}

/* ---------- footer ---------- */
export function Footer() {
  return (
    <footer className="border-t border-line bg-ink-2/60">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <Logo size={30} />
              <span className="font-display text-sm font-bold text-paper">
                bass<span className="text-amber">2</span>tabs
              </span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-faint">
              Локальная транскрибация бас-гитары: аудио → MIDI, MusicXML, GP5.
              Инференс — на GPU Apple Silicon через MPS. Гистерезисная
              сегментация нот (0.6/0.35) и high-pass 32 Гц перед CREPE.
              Исходники — настоящие .py-файлы, скачиваются напрямую.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["MIT", "Python 3.11+", "torch · MPS", "macOS 12.3+"].map((t) => (
                <span key={t} className="rounded border border-line px-2 py-1 font-mono text-[10px] text-dim">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-14">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Разделы</p>
              <ul className="mt-3 space-y-2">
                {NAV_LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-[13px] text-dim transition-colors hover:text-amber">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Стек</p>
              <ul className="mt-3 space-y-2 font-mono text-[12px] text-dim">
                <li>torchcrepe</li>
                <li>librosa · numpy</li>
                <li>mido · PyGuitarPro</li>
                <li>soundfile</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-line/60 pt-6 font-mono text-[11px] text-faint sm:flex-row sm:items-center">
          <span>Струны: E1 · A1 · D2 · G2 — строй стандартный, лады минимальные.</span>
          <span>
            собрано для <span className="text-amber">Apple Silicon</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
