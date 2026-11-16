import Image from "next/image";
import Button from "@/components/common/Button";
import SearchForm from "@/components/forms/SearchForm";
import HeroBackdrop from "@/components/sections/hero/HeroBackdrop";
import TripChoices from "@/components/packages/TripChoices";
import ScrollCue from "@/components/sections/hero/ScrollCue";
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

  return (
    <section
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

          <h1 className="mt-5 break-words font-display text-[clamp(2.125rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.035em]">
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
            <Button href={cmsText(cms, "primaryHref", "/packages")} variant="accent" size="lg" iconRight="arrow-right">
              {cmsText(cms, "primaryLabel", "Explore packages")}
            </Button>
            <Button href={cmsText(cms, "secondaryHref", "/weekend-trips")} variant={light ? "outline" : "glass"} size="lg">
              {cmsText(cms, "secondaryLabel", "Weekend group trips")}
            </Button>
          </div>

          <dl
            data-hero="stats"
            className={`mt-10 grid max-w-lg gap-3 border-t pt-6 ${heroStats.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} ${light ? "border-line" : "border-white/10"}`}
          >
            {heroStats.map((s, i) => (
              <div key={i} className="min-w-0 break-words">
                <dt className="font-display text-base font-semibold sm:text-xl">{s.value}</dt>
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
