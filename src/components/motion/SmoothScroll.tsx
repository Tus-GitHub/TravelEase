"use client";

import { useEffect, useRef } from "react";
import { ReactLenis, type LenisRef } from "lenis/react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

/**
 * Lenis smooth scroll for the marketing site, driven by GSAP's ticker so
 * ScrollTrigger stays in sync. No-ops (native scroll) when the user prefers
 * reduced motion. Nested scrollers opt out with `data-lenis-prevent`.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  const reduced = typeof window !== "undefined" && prefersReducedMotion();

  useEffect(() => {
    if (reduced) return;

    const lenis = lenisRef.current?.lenis;
    if (!lenis) return;

    const update = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    lenis.on("scroll", ScrollTrigger.update);

    return () => {
      gsap.ticker.remove(update);
      lenis.off("scroll", ScrollTrigger.update);
    };
  }, [reduced]);

  if (reduced) return <>{children}</>;

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{ autoRaf: false, lerp: 0.11, wheelMultiplier: 1, touchMultiplier: 1.6 }}
    >
      {children}
    </ReactLenis>
  );
}
