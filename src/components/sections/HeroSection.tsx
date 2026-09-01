"use client";

import { useEffect, useRef } from "react";
import Button from "@/components/common/Button";
import Magnetic from "@/components/motion/Magnetic";
import SearchForm from "@/components/forms/SearchForm";
import HeroBackdrop from "@/components/sections/hero/HeroBackdrop";
import HeroVehicle from "@/components/sections/hero/HeroVehicle";
import ScrollCue from "@/components/sections/hero/ScrollCue";
import { gsap, prefersReducedMotion } from "@/lib/motion";

const stats = [
  { value: "500+", label: "Vehicles" },
  { value: "50K+", label: "Journeys" },
  { value: "120+", label: "Cities" },
  { value: "4.9", label: "Avg. rating" },
];

export default function HeroSection() {
  const root = useRef<HTMLElement>(null);
  /** 0→1 hero scroll progress, read by the 3D rig without re-rendering React. */
  const progressRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const el = root.current;
    const mobile = window.innerWidth < 768;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      const rise = { opacity: 0, y: 24 };
      const risen = { opacity: 1, y: 0 };

      // ── entrance timeline ──────────────────────────────────────────────
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(q("[data-hero-layer]"), {
        opacity: 0,
        scale: 1.15,
        duration: 1.4,
        stagger: 0.12,
        ease: "power2.out",
      })
        .fromTo(q('[data-hero="brand"]'), rise, { ...risen, duration: 0.6 }, 0.35)
        .fromTo(
          q('[data-hero="title-line"]'),
          { opacity: 0, yPercent: 120 },
          { opacity: 1, yPercent: 0, duration: 0.9, stagger: 0.12 },
          0.5,
        )
        .fromTo(q('[data-hero="sub"]'), rise, { ...risen, duration: 0.7 }, "-=0.4")
        .fromTo(q('[data-hero="cta"]'), rise, { ...risen, duration: 0.6 }, "-=0.35")
        .fromTo(
          q('[data-hero="vehicle"]'),
          { opacity: 0, x: 60, scale: 0.96 },
          { opacity: 1, x: 0, scale: 1, duration: 1.1, ease: "power2.out" },
          "-=0.9",
        )
        .fromTo(q('[data-hero="search"]'), rise, { ...risen, duration: 0.6 }, "-=0.5")
        .fromTo(q('[data-hero="stats"]'), rise, { ...risen, duration: 0.6 }, "-=0.4")
        .fromTo(q('[data-hero="scroll"]'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, "-=0.2");

      // ── ambient vehicle float ─────────────────────────────────────────
      gsap.to(q('[data-hero="vehicle"]'), {
        y: -14,
        duration: 4,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        delay: 1.6,
      });

      // ── scroll: parallax layers + hero dissolves into the page ────────
      // Parallax is a desktop luxury; on phones it just costs frames.
      if (!mobile) {
        gsap.to(q('[data-hero-layer="1"]'), {
          yPercent: 30,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
        });
        gsap.to(q('[data-hero-layer="2"]'), {
          yPercent: -20,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
        });
      }
      gsap.to(q('[data-hero="content"]'), {
        yPercent: mobile ? -4 : -12,
        opacity: mobile ? 0.4 : 0.15,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom 40%",
          scrub: true,
          onUpdate: (self) => {
            progressRef.current = self.progress;
          },
        },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      className="relative flex min-h-[100svh] items-center overflow-hidden pb-16 pt-28 text-white lg:pt-32"
    >
      <HeroBackdrop />

      <div
        data-hero="content"
        className="section-container relative z-10 grid w-full items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]"
      >
        {/* ── copy ── */}
        <div>
          <p
            data-hero="brand"
            className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60"
          >
            Jagdamba Travellers
          </p>

          <h1 className="mt-5 font-display text-display">
            <span className="block overflow-hidden">
              <span data-hero="title-line" className="block">
                Your journey.
              </span>
            </span>
            <span className="block overflow-hidden">
              <span
                data-hero="title-line"
                className="block bg-gradient-to-r from-accent-300 via-accent-400 to-accent-500 bg-clip-text text-transparent"
              >
                Elevated.
              </span>
            </span>
          </h1>

          <p data-hero="sub" className="mt-6 max-w-md text-lg text-white/70">
            Chauffeur-driven journeys across India, engineered around you —
            verified drivers, transparent fares, one seamless booking.
          </p>

          <div data-hero="cta" className="mt-8 flex flex-wrap gap-3">
            <Magnetic>
              <Button href="/vehicles" variant="accent" size="lg" iconRight="arrow-right">
                Explore the fleet
              </Button>
            </Magnetic>
            <Button href="/booking" variant="glass" size="lg">
              Build a trip
            </Button>
          </div>

          <dl
            data-hero="stats"
            className="mt-12 grid max-w-lg grid-cols-4 gap-4 border-t border-white/10 pt-6"
          >
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="font-display text-stat">{s.value}</dt>
                <dd className="mt-1 text-xs uppercase tracking-wide text-white/60">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── vehicle ── */}
        <div className="relative">
          <HeroVehicle progressRef={progressRef} />
        </div>

        {/* ── search (spans) ── */}
        <div data-hero="search" className="lg:col-span-2">
          <SearchForm />
        </div>
      </div>

      <ScrollCue />
    </section>
  );
}
