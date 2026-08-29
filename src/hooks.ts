import { useEffect, useRef, useState } from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function useReveal<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

const GLYPHS = "▚▞▟▙#%&@$≡+×";

export function useScramble(text: string, startDelay = 200): string {
  const reduced = usePrefersReducedMotion();
  const [out, setOut] = useState(reduced ? text : text.replace(/./g, "\u00A0"));
  useEffect(() => {
    if (reduced) {
      setOut(text);
      return;
    }
    let frame = 0;
    let raf = 0;
    const total = text.length;
    const tick = () => {
      frame += 1;
      const resolved = Math.floor(frame / 3);
      if (resolved >= total) {
        setOut(text);
        return;
      }
      let s = "";
      for (let i = 0; i < total; i += 1) {
        if (i < resolved) s += text[i];
        else if (i < resolved + 5) s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        else s += "\u00A0";
      }
      setOut(s);
      raf = requestAnimationFrame(tick);
    };
    const timeout = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, startDelay);
    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [text, reduced, startDelay]);
  return out;
}

export function useNow(active: boolean, intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
