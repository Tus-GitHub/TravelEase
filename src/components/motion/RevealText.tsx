"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

/**
 * Line-mask reveal for headings (§23) — each line sits in an `overflow-hidden`
 * clip and rises into place, once, when scrolled into view. Split on `\n`.
 * Deliberately line-level, not per-character: used for editorial headings, not
 * decoration. Renders plain, fully-visible text with no JS / reduced motion.
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

    const inners = el.querySelectorAll<HTMLElement>("[data-rt-inner]");
    const anim = gsap.fromTo(
      inners,
      { yPercent: 115 },
      {
        yPercent: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger,
        delay,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      },
    );
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 400);

    return () => {
      window.clearTimeout(id);
      anim.scrollTrigger?.kill();
      anim.kill();
    };
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
