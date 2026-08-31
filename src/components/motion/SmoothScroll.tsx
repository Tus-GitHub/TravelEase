"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

/**
 * Lenis smooth-scroll for the marketing site.
 *
 * Lenis runs its own RAF (`autoRaf`, the default), so real wheel / touchpad /
 * touch input eases the *document* scroll. In `root` mode Lenis reads and
 * writes the real `window` scroll position, so keyboard, Page Up/Down,
 * Home/End, Space and dragging the native scrollbar all keep working too.
 * `<GsapBridge>` (a context child, renders nothing) forwards Lenis's scroll
 * frames to GSAP ScrollTrigger. Fully native scroll under prefers-reduced-motion.
 *
 * Architecture:  native scroll input → Lenis → ScrollTrigger → animations.
 *
 * Do NOT reintroduce `autoRaf: false` + a hand-wired `gsap.ticker` pump here —
 * `ReactLenis` populates its ref a render *after* this component's effect, so
 * the pump silently never gets wired and wheel/touch scrolling dies while the
 * scrollbar still works.
 */
function GsapBridge() {
  useLenis(() => ScrollTrigger.update());
  return null;
}

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = typeof window !== "undefined" && prefersReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <ReactLenis root options={{ lerp: 0.11, wheelMultiplier: 1, touchMultiplier: 1.6 }}>
      <GsapBridge />
      {children}
    </ReactLenis>
  );
}
