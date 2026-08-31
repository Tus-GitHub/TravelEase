import { gsap, ScrollTrigger } from "@/lib/motion";

/**
 * Shared animation vocabulary (§31 / §32).
 *
 * Every timeline in the app should pull its timing + easing from here rather
 * than hand-rolling numbers inline, so the whole site moves with one rhythm:
 *
 *   micro   150–250ms   hovers, presses, toggles           → CSS `duration-200`
 *   ui      250–500ms   inputs, tabs, drawers, small fades
 *   reveal  500–1200ms  scroll reveals, hero beats
 *
 * Easing is ease-out / power / expo only, with one restrained overshoot
 * (`pop`) — no cartoonish bounce, no elastic.
 */
export const DURATION = {
  micro: 0.2,
  ui: 0.4,
  reveal: 0.9,
  count: 1.2,
} as const;

export const EASE = {
  out: "power3.out",
  outSoft: "power2.out",
  expo: "expo.out",
  inOut: "power2.inOut",
  /** Gentle overshoot for dots / chips landing — deliberately not bouncy. */
  pop: "back.out(1.6)",
} as const;

type Target = gsap.TweenTarget;

interface RevealOpts {
  delay?: number;
  y?: number;
  x?: number;
  duration?: number;
  start?: string;
  once?: boolean;
}

/** Fade + rise (+ a touch of blur/scale) as the element scrolls into view. */
export function fadeInUp(target: Target, o: RevealOpts = {}): gsap.core.Tween {
  const {
    delay = 0,
    y = 32,
    x = 0,
    duration = DURATION.reveal,
    start = "top 86%",
    once = true,
  } = o;
  return gsap.fromTo(
    target,
    { opacity: 0, x, y, scale: 0.985, filter: "blur(8px)" },
    {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      duration,
      delay,
      ease: EASE.out,
      scrollTrigger: { trigger: target as gsap.DOMTarget, start, once },
    },
  );
}

/** Staggered fade/slide for a set of siblings (cards, list rows). */
export function staggerCards(
  targets: Target,
  o: RevealOpts & { stagger?: number; ease?: string } = {},
): gsap.core.Tween {
  const {
    delay = 0,
    y = 24,
    x = 0,
    duration = DURATION.ui,
    stagger = 0.08,
    ease = EASE.out,
    start = "top 82%",
    once = true,
  } = o;
  return gsap.from(targets, {
    opacity: 0,
    x,
    y,
    duration,
    delay,
    ease,
    stagger,
    scrollTrigger: { trigger: targets as gsap.DOMTarget, start, once },
  });
}

/** Clip-path "unmask" reveal — used for large imagery panels. */
export function scaleReveal(target: Target, o: { start?: string } = {}): gsap.core.Tween {
  return gsap.fromTo(
    target,
    { clipPath: "inset(14% 8% 14% 8% round 24px)", opacity: 0.35 },
    {
      clipPath: "inset(0% 0% 0% 0% round 24px)",
      opacity: 1,
      duration: 1,
      ease: EASE.out,
      scrollTrigger: { trigger: target as gsap.DOMTarget, start: o.start ?? "top 82%", once: true },
    },
  );
}

/** Scrubbed vertical parallax between two `yPercent` values. */
export function parallax(
  target: Target,
  o: { from?: number; to?: number; trigger?: Element } = {},
): gsap.core.Tween {
  const { from = -8, to = 8, trigger } = o;
  return gsap.fromTo(
    target,
    { yPercent: from },
    {
      yPercent: to,
      ease: "none",
      scrollTrigger: {
        trigger: (trigger ?? target) as gsap.DOMTarget,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    },
  );
}

/** Line-mask reveal for a heading container holding `[data-rt-inner]` spans. */
export function revealLines(
  container: HTMLElement,
  o: { delay?: number; stagger?: number; start?: string } = {},
): gsap.core.Tween {
  const { delay = 0, stagger = 0.1, start = "top 88%" } = o;
  const inners = container.querySelectorAll<HTMLElement>("[data-rt-inner]");
  return gsap.fromTo(
    inners,
    { yPercent: 115 },
    {
      yPercent: 0,
      duration: DURATION.reveal,
      ease: EASE.out,
      stagger,
      delay,
      scrollTrigger: { trigger: container, start, once: true },
    },
  );
}

/**
 * One shared, debounced `ScrollTrigger.refresh()` (§33). Reveal components call
 * this on mount instead of each scheduling its own timeout — so a page with 20
 * reveals still triggers a single recalculation after layout settles.
 */
let refreshTimer: number | undefined;
export function scheduleRefresh(delay = 400): void {
  if (typeof window === "undefined") return;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), delay);
}
