"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { DURATION, EASE } from "@/lib/motion/presets";

/** Counts from 0 → value the first time it scrolls into view. */
export default function CountUp({
  value,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const obj = { n: 0 };
    const tween = gsap.to(obj, {
      n: value,
      duration: DURATION.count,
      ease: EASE.outSoft,
      onUpdate: () => setDisplay(Math.round(obj.n)),
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}
