"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { parallax, scheduleRefresh } from "@/lib/motion/presets";

/**
 * Wraps children in a scrubbed vertical parallax as the block passes through
 * the viewport. Desktop-ish only — disabled under reduced motion and (opt-in)
 * on narrow screens. Thin wrapper over the `parallax` preset.
 */
export default function Parallax({
  children,
  className = "",
  from = -8,
  to = 8,
  /** Skip below this width (px). Default: always on. */
  minWidth = 0,
}: {
  children: ReactNode;
  className?: string;
  from?: number;
  to?: number;
  minWidth?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (minWidth && window.innerWidth < minWidth) return;

    const ctx = gsap.context(() => {
      parallax(el, { from, to });
    }, el);
    scheduleRefresh();
    return () => ctx.revert();
  }, [from, to, minWidth]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
