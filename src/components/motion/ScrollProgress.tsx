"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

/**
 * Travel-themed page-scroll indicator (§22): a hairline route across the top
 * that fills as you descend, with a soft signal-light travelling along its
 * head. Subtle by design — communicates progress without pulling focus.
 */
export default function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const common = {
      start: 0,
      end: () => ScrollTrigger.maxScroll(window),
      scrub: 0.3,
      invalidateOnRefresh: true,
    };

    const fill = gsap.fromTo(
      el,
      { scaleX: 0 },
      { scaleX: 1, ease: "none", scrollTrigger: { ...common } },
    );

    // The travelling light is decorative — skip it under reduced motion.
    const reduced = prefersReducedMotion();
    const dot = head.current;
    let travel: ReturnType<typeof gsap.fromTo> | undefined;
    if (dot && !reduced) {
      dot.style.opacity = "1";
      travel = gsap.fromTo(
        dot,
        { left: "0%" },
        { left: "100%", ease: "none", scrollTrigger: { ...common } },
      );
    }

    return () => {
      fill.scrollTrigger?.kill();
      fill.kill();
      travel?.scrollTrigger?.kill();
      travel?.kill();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] overflow-x-clip"
    >
      <div className="absolute inset-0 bg-fg/5" />
      <div
        ref={bar}
        className="absolute inset-0 origin-left scale-x-0 bg-gradient-to-r from-tech-400 via-accent-400 to-accent-500"
      />
      <div
        ref={head}
        className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tech-300 opacity-0 shadow-[0_0_10px_2px_rgba(56,189,248,0.55)]"
      />
    </div>
  );
}
