"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

interface AnimateInViewProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** How far (px) to slide up from. Default 32. */
  y?: number;
  /** Reveal direction bias. */
  from?: "up" | "left" | "right";
}

/**
 * Cinematic scroll reveal — fade + rise + a touch of blur/scale, once, driven
 * by GSAP ScrollTrigger (synced to Lenis). Content is fully visible with no JS
 * or under prefers-reduced-motion. Same API as the old Framer version.
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

    const start =
      from === "left"
        ? { opacity: 0, x: -y, y: 0, filter: "blur(8px)" }
        : from === "right"
          ? { opacity: 0, x: y, y: 0, filter: "blur(8px)" }
          : { opacity: 0, x: 0, y, filter: "blur(8px)" };

    const anim = gsap.fromTo(
      el,
      { ...start, scale: 0.985 },
      {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.9,
        delay,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 86%", once: true },
      },
    );

    return () => {
      anim.scrollTrigger?.kill();
      anim.kill();
    };
  }, [delay, y, from]);

  // Refresh once after mount so triggers measure post-layout (fonts, images).
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
