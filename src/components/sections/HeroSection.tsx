"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Button from "@/components/common/Button";
import Magnetic from "@/components/motion/Magnetic";
import SearchForm from "@/components/forms/SearchForm";
import HeroBackdrop from "@/components/sections/hero/HeroBackdrop";
import TripChoices from "@/components/packages/TripChoices";
import ScrollCue from "@/components/sections/hero/ScrollCue";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { cmsText, cmsItems, type CmsSection } from "@/lib/cms";

const stats = [
  { value: "Planned", label: "Packages" },
  { value: "Together", label: "Weekend trips" },
  { value: "Your way", label: "Custom routes" },
];

export default function HeroSection({ cms }: { cms?: CmsSection } = {}) {
  const heroStats = cmsItems(cms) ?? stats;
  const imageUrl = cmsText(cms, "imageUrl");
  const appearance = cms?.appearance;
  const light = appearance?.background === "light" || appearance?.background === "muted";
  const muted = light ? "text-muted" : "text-white/70";
  const showVehicle = cms?.content.showVehicle !== false;
  const showSearch = cms?.content.showSearch === true;
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const el = root.current;
    const mobile = window.innerWidth < 768;
    // The SSR text, image and trip search stay visible on phones. No
    // hydration-time hide/reveal or perpetual float competes with first paint.
    if (mobile) return;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      // A short desktop lift preserves the visual treatment without hiding
      // already-rendered copy, controls or the priority image after hydration.
      gsap.from(q('[data-hero="brand"], [data-hero="sub"], [data-hero="cta"]'), {
        y: 8, duration: 0.25, ease: "power3.out",
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
        },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      id={cms ? `section-${cms.id}` : undefined}
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
                {cmsText(cms, "title", "Less planning.")}
              </span>
            </span>
            <span className="block overflow-hidden">
              <span
                data-hero="title-line"
                className="block bg-gradient-to-r from-accent-300 via-accent-400 to-accent-500 bg-clip-text text-transparent"
              >
                {cmsText(cms, "highlight", "More memories.")}
              </span>
            </span>
          </h1>

          <p data-hero="sub" className={`mt-6 max-w-md text-lg ${muted}`}>
            {cmsText(cms, "subtitle", "Ready-made getaways, weekend groups and trips shaped around you. Explore the itinerary, see what is included and make room for the memories.")}
          </p>

          <div data-hero="cta" className="mt-8 flex flex-wrap gap-3">
            <Magnetic>
              <Button href={cmsText(cms, "primaryHref", "/packages")} variant="accent" size="lg" iconRight="arrow-right">
                {cmsText(cms, "primaryLabel", "Explore packages")}
              </Button>
            </Magnetic>
            <Button href={cmsText(cms, "secondaryHref", "/weekend-trips")} variant={light ? "outline" : "glass"} size="lg">
              {cmsText(cms, "secondaryLabel", "Weekend group trips")}
            </Button>
          </div>

          <dl
            data-hero="stats"
            className="mt-12 grid max-w-lg grid-cols-2 gap-4 sm:grid-cols-3 border-t border-white/10 pt-6"
          >
            {heroStats.map((s, i) => (
              <div key={i}>
                <dt className="font-display text-xl font-semibold sm:text-2xl">{s.value}</dt>
                <dd className={`mt-1 text-xs uppercase tracking-wide ${muted}`}>{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── vehicle ── */}
        <div className={showVehicle ? "relative" : "hidden"}>
          {showVehicle ? imageUrl ? <div data-hero="vehicle" className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl"><Image src={imageUrl} alt={cmsText(cms, "imageAlt")} fill priority sizes="(max-width:1024px) 100vw,50vw" className="object-cover" /></div> : <TripChoices /> : <div data-hero="vehicle" />}
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
