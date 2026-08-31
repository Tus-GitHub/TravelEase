"use client";

import { useEffect, useRef } from "react";
import Section from "@/components/common/Section";
import Icon from "@/components/common/Icon";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import type { IconName } from "@/types";

const steps: { n: string; title: string; body: string; icon: IconName }[] = [
  { n: "01", title: "Plan", body: "Tell us the route, the dates and the kind of vehicle. Get a transparent, all-in quote.", icon: "map-pin" },
  { n: "02", title: "Choose", body: "Compare chauffeur-driven options — sedans to coaches — with real photos and pricing.", icon: "car" },
  { n: "03", title: "Book", body: "Confirm in a tap. Book now, pay offline. Your driver's details arrive before pickup.", icon: "check" },
  { n: "04", title: "Travel", body: "Door to door with a verified driver. Change plans mid-trip? We adjust, no drama.", icon: "arrow-right" },
];

export default function HowItWorks() {
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
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: step, start: "top 82%", once: true },
        });
        gsap.fromTo(
          step.querySelector("[data-hiw='dot']"),
          { scale: 0, boxShadow: "0 0 0 0 rgba(245,158,11,0)" },
          {
            scale: 1,
            duration: 0.5,
            ease: "back.out(2.4)",
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
    >
      <div ref={root} className="relative mx-auto max-w-3xl">
        {/* connecting line */}
        <svg
          className="pointer-events-none absolute left-[27px] top-4 h-[calc(100%-2rem)] w-2 sm:left-[31px]"
          viewBox="0 0 4 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M2 0 V100" stroke="rgb(var(--c-line))" strokeWidth="2" />
          <path
            data-hiw="line"
            d="M2 0 V100"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        <ol className="space-y-10">
          {steps.map((s) => (
            <li key={s.n} data-hiw="step" className="relative flex gap-6 pl-0">
              <div
                data-hiw="dot"
                className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-800 to-primary-950 text-white ring-1 ring-white/10 dark:from-primary-700 dark:to-primary-900"
              >
                <Icon name={s.icon} className="h-5 w-5 text-accent-300" />
                <span className="absolute -right-2 -top-2 rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">
                  {s.n}
                </span>
              </div>
              <div className="pt-1.5">
                <h3 className="font-display text-xl font-bold text-fg">{s.title}</h3>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
