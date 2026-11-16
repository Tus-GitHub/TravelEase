"use client";

import { useEffect, useRef } from "react";

/** Update on scroll and geometry changes; no idle animation loop. */
export default function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Streamed catalogue sections change the height after first paint.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, []);

  return <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] bg-fg/5">
    <div ref={bar} data-scroll-progress className="absolute inset-0 origin-left scale-x-0 bg-gradient-to-r from-tech-400 via-accent-400 to-accent-500" />
  </div>;
}
