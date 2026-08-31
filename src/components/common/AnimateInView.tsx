"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { fadeInUp, scheduleRefresh } from "@/lib/motion/presets";

interface AnimateInViewProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** How far (px) to travel from. Default 32. */
  y?: number;
  /** Reveal direction bias. */
  from?: "up" | "left" | "right";
}

/**
 * Cinematic scroll reveal — fade + rise + a touch of blur/scale, once. Thin
 * wrapper over the shared `fadeInUp` preset; content is fully visible with no
 * JS or under prefers-reduced-motion.
 */
export default function AnimateInView({
  children,
  delay = 0,
  className,
  y = 32,
  from = "up",
}: AnimateInViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const offset = from === "left" ? { x: -y, y: 0 } : from === "right" ? { x: y, y: 0 } : { x: 0, y };
    const ctx = gsap.context(() => {
      fadeInUp(el, { delay, ...offset });
    }, el);
    scheduleRefresh();

    return () => ctx.revert();
  }, [delay, y, from]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
