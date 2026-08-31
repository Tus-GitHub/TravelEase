"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { DURATION, EASE } from "@/lib/motion/presets";

/**
 * The authentication surface — a refined translucent panel that reads as part
 * of the TravelEase design system: dark tinted glass, hairline border, a soft
 * top highlight, deep shadow, generous padding. Not a floating glass rectangle;
 * not fully transparent. One quiet entrance on mount.
 */
export default function AuthCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(el, {
        opacity: 0,
        y: 18,
        duration: DURATION.reveal,
        ease: EASE.out,
      });
      gsap.from("[data-auth-stagger] > *", {
        opacity: 0,
        y: 12,
        duration: DURATION.ui,
        ease: EASE.outSoft,
        stagger: 0.06,
        delay: 0.15,
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-7 shadow-[0_40px_120px_-24px_rgba(2,6,20,0.85)] backdrop-blur-xl sm:p-9"
    >
      {/* soft highlight along the top edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {children}
    </div>
  );
}
