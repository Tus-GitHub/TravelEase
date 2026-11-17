"use client";

import { useEffect, useRef } from "react";
import Section from "@/components/common/Section";
import Icon from "@/components/common/Icon";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { DURATION, EASE } from "@/lib/motion/presets";
import type { IconName } from "@/types";
import { cmsHeading, cmsItems, type CmsSection } from "@/lib/cms";

const steps: { n: string; title: string; body: string; icon: IconName }[] = [
  { n: "01", title: "Plan", body: "Tell us the route, the dates and the kind of vehicle. Get a transparent, all-in quote.", icon: "map-pin" },
  { n: "02", title: "Choose", body: "Compare chauffeur-driven options — sedans to coaches — with real photos and pricing.", icon: "car" },
  { n: "03", title: "Book", body: "Confirm in a tap. Book now, pay offline. Your driver's details arrive before pickup.", icon: "check" },
  { n: "04", title: "Travel", body: "Door to door with a verified driver. Change plans mid-trip? We adjust, no drama.", icon: "arrow-right" },
];

export default function HowItWorks({ cms }: { cms?: CmsSection } = {}) {
  const entries = (cmsItems(cms) as typeof steps | undefined) ?? steps;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const el = root.current;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);

      // line draws with scroll
      const line = q<SVGPathElement>("[data-hiw='line']")[0];
      if (line) {
        const len = line.getTotalLength();
        gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(line, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 70%", end: "bottom 80%", scrub: 0.4 },
        });
      }

      q<HTMLElement>("[data-hiw='step']").forEach((step) => {
        gsap.from(step, {
          opacity: 0,
          x: -24,
          duration: DURATION.reveal,
          ease: EASE.out,
          scrollTrigger: { trigger: step, start: "top 82%", once: true },
        });
        gsap.fromTo(
          step.querySelector("[data-hiw='dot']"),
          { scale: 0 },
          {
            scale: 1,
            duration: DURATION.ui,
            ease: EASE.pop,
            scrollTrigger: { trigger: step, start: "top 80%", once: true },
          },
        );
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Section
      bg="white"
      eyebrow="The Journey"
      title="Four steps, one seamless trip"
      subtitle="From first idea to arrival — planned around you, driven for you."
      {...cmsHeading(cms)}
    >
      <div ref={root} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {entries.map((s, i) => (
          <div
            key={i}
            data-hiw="step"
            className="group relative overflow-hidden rounded-3xl border border-line/80 bg-surface p-6 shadow-[0_14px_40px_-18px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-400/40 hover:shadow-[0_24px_60px_-16px_rgba(245,158,11,0.16)]"
          >
            <div className="luxury-hairline pointer-events-none absolute inset-x-8 top-0 opacity-60" aria-hidden />
            <div className="flex items-start justify-between">
              <div
                data-hiw="dot"
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-400 transition-colors group-hover:bg-accent-500 group-hover:text-slate-950"
              >
                <Icon name={s.icon} className="h-5 w-5" />
              </div>
              <span className="font-serif text-4xl font-semibold italic leading-none text-amber-400/25 transition-colors group-hover:text-amber-400/45">
                {s.n}
              </span>
            </div>
            <h3 className="mt-6 font-display text-xl font-bold text-fg">{s.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
