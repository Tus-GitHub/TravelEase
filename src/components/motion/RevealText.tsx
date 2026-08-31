"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { revealLines, scheduleRefresh } from "@/lib/motion/presets";

/**
 * Line-mask reveal for headings (§23) — each line sits in an `overflow-hidden`
 * clip and rises into place, once, when scrolled into view. Split on `\n`.
 * Deliberately line-level, not per-character. Renders plain, fully-visible text
 * with no JS / under reduced motion.
 */
export default function RevealText({
  text,
  className = "",
  delay = 0,
  stagger = 0.1,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const lines = text.split("\n");

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      revealLines(el, { delay, stagger });
    }, el);
    scheduleRefresh();
    return () => ctx.revert();
  }, [delay, stagger]);

  return (
    <span ref={ref} className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.06em]">
          <span data-rt-inner className="block will-change-transform">
            {line}
          </span>
        </span>
      ))}
    </span>
  );
}
