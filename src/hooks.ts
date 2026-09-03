import { useEffect, useRef, useState } from "react";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" &&
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

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

const SCRAMBLE = "█▓▒░<>/\\|=+*#";

export function useScramble(target: string, delay = 200) {
  const reduced = usePrefersReducedMotion();
  const [out, setOut] = useState(reduced ? target : "");
  useEffect(() => {
    if (reduced) {
      setOut(target);
      return;
    }
    let frame = 0;
    let raf = 0;
    const total = target.length * 3 + 8;
    const tick = () => {
      frame += 1;
      const settled = Math.floor((frame / total) * target.length);
      let s = "";
      for (let i = 0; i < target.length; i += 1) {
        if (i < settled) s += target[i];
        else if (target[i] === " ") s += " ";
        else s += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
      }
      setOut(s);
      if (settled < target.length) raf = requestAnimationFrame(tick);
      else setOut(target);
    };
    const t = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [target, delay, reduced]);
  return out;
}
