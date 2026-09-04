import { useEffect, useRef, useState } from "react";

const motionOff = () =>
  typeof document !== "undefined" && document.documentElement.dataset["motion"] === "off";

/**
 * Stages [data-reveal], [data-reveal-crop] and [data-reveal-rule] elements
 * inside the given root as they enter the viewport. Idempotent and cheap:
 * each element is unobserved once shown.
 */
export function useReveal() {
  const root = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const scope: ParentNode = root.current ?? document;
    const nodes = Array.from(
      scope.querySelectorAll<HTMLElement>("[data-reveal],[data-reveal-crop],[data-reveal-rule]"),
    );
    if (nodes.length === 0) return;

    const show = (el: HTMLElement) => {
      for (const attr of ["data-reveal", "data-reveal-crop", "data-reveal-rule"]) {
        if (el.hasAttribute(attr)) el.setAttribute(attr, "shown");
      }
    };

    if (motionOff() || typeof IntersectionObserver === "undefined") {
      nodes.forEach(show);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          show(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  });

  return root;
}

/** Scroll-linked hero parallax. Returns a ref for the image layer. */
export function useParallax(strength = 0.28) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || motionOff()) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / (rect.height || 1)));
      el.style.setProperty("--parallax-y", `${progress * rect.height * strength}px`);
      el.style.setProperty("--parallax-scale", `${1.08 + progress * 0.06}`);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [strength]);

  return ref;
}

/** Counts a readout up on first view. Falls back to the final value instantly. */
export function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(target);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || motionOff() || typeof IntersectionObserver === "undefined") {
      setValue(target);
      return;
    }

    let raf = 0;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (started || !entries.some((e) => e.isIntersecting)) return;
        started = true;
        io.disconnect();
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(target * eased));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        setValue(0);
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, duration]);

  return [value, ref] as const;
}
