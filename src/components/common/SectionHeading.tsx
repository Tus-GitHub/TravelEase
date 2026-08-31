"use client";

import { useEffect, useRef } from "react";
import RevealText from "@/components/motion/RevealText";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { DURATION, EASE, scheduleRefresh } from "@/lib/motion/presets";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  /** Use light text on dark (primary) section backgrounds. */
  inverted?: boolean;
}

/**
 * Eyebrow + heading + subtext block at the top of every section. The heading
 * carries the editorial display scale (§23) and reveals itself line-by-line
 * with a mask; the eyebrow and subtitle fade in around it. All static under
 * reduced motion.
 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  inverted = false,
}: SectionHeadingProps) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    if (!el.querySelector("[data-sh-fade]")) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-sh-fade]", {
        opacity: 0,
        y: 14,
        duration: DURATION.ui,
        ease: EASE.outSoft,
        stagger: 0.12,
        scrollTrigger: { trigger: el, start: "top 86%", once: true },
      });
    }, el);
    scheduleRefresh();
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={root}
      className={`max-w-2xl ${
        align === "center" ? "mx-auto text-center" : "text-left"
      }`}
    >
      {eyebrow && (
        <p
          data-sh-fade
          className={`text-eyebrow ${inverted ? "text-accent-400" : "text-accent-500"}`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`mt-3 font-display text-display-sm text-balance ${
          inverted ? "text-white" : "text-fg"
        }`}
      >
        <RevealText text={title} />
      </h2>
      {subtitle && (
        <p
          data-sh-fade
          className={`mt-4 text-lg text-pretty ${
            inverted ? "text-primary-100" : "text-muted"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
