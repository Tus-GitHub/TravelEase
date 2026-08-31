import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  // Keep scrub animations from lurching to catch up after a dropped frame.
  gsap.ticker.lagSmoothing(0);
}

/** True when the user asked for reduced motion (SSR-safe → false on the server). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * True for a mouse-class pointer (desktop). Gates cursor/magnetic effects so
 * they never run on touch devices — where "hover" and "approach" don't exist.
 */
export function isFinePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches
  );
}

/** Cheap WebGL capability probe, used to decide whether to mount R3F at all. */
export function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export { gsap, ScrollTrigger };
