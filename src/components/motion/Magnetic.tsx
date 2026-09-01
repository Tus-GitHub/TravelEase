"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, prefersReducedMotion, isFinePointer } from "@/lib/motion";

/**
 * Premium magnetic interaction for a *single* important CTA (§20): as the
 * cursor approaches, the button eases toward it; on leave it springs back.
 * Reserved for Explore / Plan My Journey / Book Now / View Vehicle — never
 * every button. Desktop-only, no-op under reduced motion.
 *
 * The travel is hard-clamped to `max` px so a wide/full-width button gets the
 * same subtle nudge as a small one (without the clamp, `offset * strength`
 * grows with the element and drags it right across the layout).
 */
export default function Magnetic({
  children,
  className = "",
  /** Fraction of the cursor offset the button travels, before clamping. */
  strength = 0.3,
  /** Pixels of empty space around the button that still "pull" it. */
  radius = 90,
  /** Maximum travel in px, each axis. Keep this small — it's a nudge. */
  max = 8,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
  radius?: number;
  max?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !isFinePointer()) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    const clamp = gsap.utils.clamp(-max, max);
    let engaged = false;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // Engage zone hugs the button — based on its *shorter* side so a
      // full-width button doesn't pull from half a screen away.
      const reach = radius + Math.min(r.width, r.height) / 2;

      if (dx * dx + dy * dy <= reach * reach) {
        engaged = true;
        xTo(clamp(dx * strength));
        yTo(clamp(dy * strength));
      } else if (engaged) {
        engaged = false;
        xTo(0);
        yTo(0);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      gsap.killTweensOf(el);
      gsap.set(el, { x: 0, y: 0 });
    };
  }, [strength, radius, max]);

  return (
    <span ref={ref} className={`inline-flex will-change-transform ${className}`}>
      {children}
    </span>
  );
}
