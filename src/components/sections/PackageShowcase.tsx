"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import Section from "@/components/common/Section";
import Icon from "@/components/common/Icon";
import CountUp from "@/components/motion/CountUp";
import Spotlight from "@/components/motion/Spotlight";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { travelPackages } from "@/data/packages";

const featured = travelPackages.slice(0, 3);

export default function PackageShowcase() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const el = root.current;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-pkg-card]").forEach((card) => {
        gsap.fromTo(
          card,
          { clipPath: "inset(14% 8% 14% 8% round 24px)", opacity: 0.35 },
          {
            clipPath: "inset(0% 0% 0% 0% round 24px)",
            opacity: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: card, start: "top 82%", once: true },
          },
        );
        const img = card.querySelector("[data-pkg-img]");
        if (img) {
          gsap.fromTo(
            img,
            { yPercent: -8 },
            {
              yPercent: 8,
              ease: "none",
              scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true },
            },
          );
        }
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Section
      bg="gray"
      eyebrow="Curated Journeys"
      title="Travel packages, cinematically planned"
      subtitle="Multi-day routes with a dedicated chauffeur, handpicked stays and the driving sorted."
    >
      <div ref={root} className="grid gap-6 md:grid-cols-3">
        {featured.map((p) => (
          <Link
            key={p.id}
            href="/booking"
            data-pkg-card
            className="group relative block aspect-[3/4] overflow-hidden rounded-3xl border border-line-subtle bg-black"
          >
            <Spotlight className="h-full w-full" size={260}>
              <div data-pkg-img className="absolute inset-0 scale-110">
                <Image
                  src={p.imageUrl}
                  alt={p.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

              {/* top meta */}
              <div className="absolute inset-x-5 top-5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/70">
                <span>{p.region}</span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">{p.tag}</span>
              </div>

              {/* bottom stack */}
              <div className="absolute inset-x-5 bottom-5 text-white">
                <h3 className="font-display text-3xl font-extrabold leading-none tracking-tight transition-transform duration-500 group-hover:-translate-y-1">
                  {p.destinations[p.destinations.length - 1]}
                </h3>
                <p className="mt-1 text-sm text-white/70">
                  {p.destinations.join(" · ")}
                </p>

                <div className="mt-3 overflow-hidden">
                  <div className="translate-y-2 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                    <p className="text-xs text-white/60">
                      {p.duration} Days / {p.duration - 1} Nights · up to {p.maxPersons} guests
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <p className="text-sm">
                    <span className="text-white/55">Starting </span>
                    <CountUp
                      value={p.pricePerPerson}
                      prefix="₹"
                      className="font-display text-xl font-bold"
                    />
                    <span className="text-white/55"> /person</span>
                  </p>
                  <span className="flex items-center gap-1 text-sm font-semibold text-accent-300 transition-transform duration-300 group-hover:translate-x-1">
                    Explore <Icon name="arrow-right" className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Spotlight>
          </Link>
        ))}
      </div>
    </Section>
  );
}
