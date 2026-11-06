"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Button from "@/components/common/Button";
import Magnetic from "@/components/motion/Magnetic";
import SearchForm from "@/components/forms/SearchForm";
import HeroBackdrop from "@/components/sections/hero/HeroBackdrop";
import HeroVehicle from "@/components/sections/hero/HeroVehicle";
import ScrollCue from "@/components/sections/hero/ScrollCue";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { cmsText, cmsItems, type CmsSection } from "@/lib/cms";

const stats = [
  { value: "500+", label: "Vehicles" },
  { value: "50K+", label: "Journeys" },
  { value: "120+", label: "Cities" },
  { value: "4.9", label: "Avg. rating" },
];

export default function HeroSection({ cms }: { cms?: CmsSection } = {}) {
  const heroStats = cmsItems(cms) ?? stats;
  const imageUrl = cmsText(cms, "imageUrl");
  const appearance = cms?.appearance;
  const light = appearance?.background === "light" || appearance?.background === "muted";
  const muted = light ? "text-muted" : "text-white/70";
  const showVehicle = cms?.content.showVehicle !== false;
  const showSearch = cms?.content.showSearch !== false;
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
      data-cms-section={cms?.id}
      className={`relative flex min-h-[100svh] items-center overflow-hidden pb-16 pt-28 lg:pt-32 ${light ? "text-fg" : "text-white"}`}
    >
      {appearance?.background === "image" ? <div data-hero-layer="1" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(4,7,15,${appearance.overlay / 100}),rgba(4,7,15,${appearance.overlay / 100})),url(${JSON.stringify(appearance.imageUrl)})` }} />
        : light ? <div data-hero-layer="1" className={`absolute inset-0 ${appearance?.background === "muted" ? "bg-surface-muted" : "bg-canvas"}`} /> : <HeroBackdrop />}

      <div
        data-hero="content"
        className={`section-container relative z-10 grid w-full items-center gap-12 ${showVehicle ? "lg:grid-cols-[1.05fr_0.95fr]" : "max-w-5xl"}`}
      >
        {/* ── copy ── */}
        <div>
          <p
            data-hero="brand"
            className={`text-xs font-semibold uppercase tracking-[0.4em] ${muted}`}
          >
            {cmsText(cms, "brand", "Jagdamba Travellers")}
          </p>

          <h1 className="mt-5 font-display text-display">
            <span className="block overflow-hidden">
              <span data-hero="title-line" className="block">
                {cmsText(cms, "title", "Your journey.")}
              </span>
            </span>
            <span className="block overflow-hidden">
              <span
                data-hero="title-line"
                className="block bg-gradient-to-r from-accent-300 via-accent-400 to-accent-500 bg-clip-text text-transparent"
              >
                {cmsText(cms, "highlight", "Elevated.")}
              </span>
            </span>
          </h1>

          <p data-hero="sub" className={`mt-6 max-w-md text-lg ${muted}`}>
            {cmsText(cms, "subtitle", "Chauffeur-driven journeys across India, engineered around you — verified drivers, transparent fares, one seamless booking.")}
          </p>

          <div data-hero="cta" className="mt-8 flex flex-wrap gap-3">
            <Magnetic>
              <Button href={cmsText(cms, "primaryHref", "/vehicles")} variant="accent" size="lg" iconRight="arrow-right">
                {cmsText(cms, "primaryLabel", "Explore the fleet")}
              </Button>
            </Magnetic>
            <Button href={cmsText(cms, "secondaryHref", "/booking")} variant={light ? "outline" : "glass"} size="lg">
              {cmsText(cms, "secondaryLabel", "Build a trip")}
            </Button>
          </div>

          <dl
            data-hero="stats"
            className="mt-12 grid max-w-lg grid-cols-4 gap-4 border-t border-white/10 pt-6"
          >
            {heroStats.map((s, i) => (
              <div key={i}>
                <dt className="font-display text-stat">{s.value}</dt>
                <dd className={`mt-1 text-xs uppercase tracking-wide ${muted}`}>{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── vehicle ── */}
        <div className={showVehicle ? "relative" : "hidden"}>
          {showVehicle ? imageUrl ? <div data-hero="vehicle" className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl"><Image src={imageUrl} alt={cmsText(cms, "imageAlt")} fill priority sizes="(max-width:1024px) 100vw,50vw" className="object-cover" /></div> : <HeroVehicle progressRef={progressRef} /> : <div data-hero="vehicle" />}
        </div>

        {/* ── search (spans) ── */}
        <div data-hero="search" className={showSearch ? (showVehicle ? "lg:col-span-2" : "") : "hidden"}>
          {showSearch && <SearchForm />}
        </div>
      </div>

      <ScrollCue />
    </section>
  );
}
