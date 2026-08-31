"use client";

import { useEffect } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { EASE } from "@/lib/motion/presets";

/**
 * One coordinated entrance for the auth shell (§7): atmosphere → branding →
 * headline → visual → card, in that order, in ~1.2s so the page is usable
 * almost immediately. Fade + small lift + a touch of scale only — no bounce,
 * no big zoom. Skipped entirely under reduced motion (everything is already at
 * rest). Runs once on layout mount; the Sign In / Sign Up swap and the card
 * *content* entrance are handled by `.auth-swap` on AuthTemplate.
 *
 * Uses `gsap.context()` so React 18's double-invoked effects (dev) don't leave
 * elements stuck at their `from` (opacity: 0) state — `ctx.revert()` restores
 * the originals before the effect re-runs.
 */
export default function AuthIntro() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const el = (name: string) =>
        gsap.utils.toArray<HTMLElement>(`[data-auth-el="${name}"]`);
      const tl = gsap.timeline({ defaults: { ease: EASE.out } });

      tl.from(el("aurora"), { opacity: 0, duration: 1.2, ease: "none" }, 0)
        .from(el("nav"), { opacity: 0, y: -8, duration: 0.4 }, 0.1)
        .from(el("headline"), { opacity: 0, y: 14, duration: 0.7 }, 0.28)
        .from(
          el("visual"),
          { opacity: 0, scale: 1.04, duration: 0.9, ease: EASE.outSoft },
          0.35,
        )
        .from(el("card"), { opacity: 0, y: 20, scale: 0.985, duration: 0.7 }, 0.5);
    });

    return () => ctx.revert();
  }, []);

  return null;
}
