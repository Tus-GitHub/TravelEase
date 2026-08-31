"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/motion";

/** Thin top bar that tracks page-scroll progress. */
export default function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const anim = gsap.fromTo(
      el,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          start: 0,
          end: () => ScrollTrigger.maxScroll(window),
          scrub: 0.3,
          invalidateOnRefresh: true,
        },
      },
    );
    return () => {
      anim.scrollTrigger?.kill();
      anim.kill();
    };
  }, []);

  return (
    <div
      ref={bar}
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left scale-x-0 bg-gradient-to-r from-accent-300 via-accent-400 to-accent-500"
    />
  );
}
