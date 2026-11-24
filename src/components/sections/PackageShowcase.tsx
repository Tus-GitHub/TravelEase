import Image from "next/image";
import Link from "next/link";
import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import PackageCard from "@/components/cards/PackageCard";
import type { TravelPackage } from "@/types";
import { cmsHeading, type CmsSection } from "@/lib/cms";

function FlagshipPackageSpotlight({ pkg }: { pkg: TravelPackage }) {
  const durationLabel = `${pkg.duration}${pkg.durationMaxDays && pkg.durationMaxDays > pkg.duration ? `–${pkg.durationMaxDays}` : ""} Days`;
  return (
    <div className="group relative grid overflow-hidden rounded-[2rem] border border-amber-400/25 bg-surface shadow-[0_30px_90px_-24px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] lg:grid-cols-[1.25fr_1fr]">
      <div className="luxury-hairline pointer-events-none absolute inset-x-12 top-0 z-20" aria-hidden />
      <div className="relative min-h-[280px] overflow-hidden sm:min-h-[340px] lg:min-h-[420px]">
        <Image
          src={pkg.imageUrl}
          alt={pkg.name}
          fill
          sizes="(max-width: 1024px) 100vw, 55vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-slate-950/20 lg:to-slate-950/75" />
        <span className="absolute left-5 top-5 rounded-full bg-accent-500 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-sm">
          {pkg.tag}
        </span>
        <span className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/75 px-3.5 py-1.5 text-xs font-semibold text-amber-200 backdrop-blur-md">
          <Icon name="calendar" className="h-3.5 w-3.5 text-amber-400" />
          {durationLabel}
        </span>
        <div className="absolute bottom-5 left-5 right-5">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-300">
            {pkg.region} · Signature Route
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {pkg.destinations.map((dest, i) => (
              <span key={dest} className="flex items-center gap-1.5">
                <span className="rounded-full border border-white/15 bg-slate-950/65 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {dest}
                </span>
                {i < pkg.destinations.length - 1 && (
                  <Icon name="arrow-right" className="h-3 w-3 text-amber-400" />
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between p-7 sm:p-9 lg:p-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-500 dark:text-amber-300">
            Flagship Private Package
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold leading-tight text-fg sm:text-3xl">
            <Link href={`/packages/${pkg.id}`} className="transition-colors hover:text-amber-400">
              {pkg.name}
            </Link>
          </h3>

          <ul className="mt-5 space-y-2.5">
            {pkg.highlights.slice(0, 4).map((h) => (
              <li key={h} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                {h}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-line-subtle pt-5 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Icon name="car" className="h-4 w-4 text-amber-400" />
              {pkg.vehicleType}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="users" className="h-4 w-4 text-amber-400" />
              Up to {pkg.maxPersons} seats
            </span>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-4 border-t border-line-subtle pt-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-faint">Private vehicle</p>
            <p className="mt-1">
              <span className="font-display text-3xl font-extrabold text-primary-900 dark:text-amber-300">
                {pkg.isGuided ? "From " : ""}₹{pkg.pricePerPerson.toLocaleString("en-IN")}
              </span>
              <span className="ml-1.5 text-xs text-faint">/ vehicle</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button
              href={pkg.isGuided ? `/packages/${pkg.id}#build-trip` : `/packages/${pkg.id}#book-package`}
              variant="accent"
              size="md"
              iconRight="arrow-right"
              disabled={pkg.isBookable === false}
            >
              {pkg.isBookable === false ? "Unavailable" : pkg.isGuided ? "Build this trip" : "Book This Package"}
            </Button>
            <Button href={`/packages/${pkg.id}`} variant="outline" size="md">
              Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PackageShowcase({ packages, cms }: { packages: TravelPackage[]; cms?: CmsSection }) {
  const featured = packages.slice(0, 3);
  return <Section bg="gray" eyebrow="Ready-made getaways" title="Start with a travel package" subtitle="Explore the itinerary, stays, meals and activities listed in each package before you book." {...cmsHeading(cms)}>
    {featured.length === 1 ? (
      <FlagshipPackageSpotlight pkg={featured[0]} />
    ) : featured.length === 2 ? (
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
        {featured.map(pkg => <PackageCard key={pkg.id} pkg={pkg} />)}
      </div>
    ) : featured.length ? (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{featured.map(pkg => <PackageCard key={pkg.id} pkg={pkg} />)}</div>
    ) : (
      <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-6 text-center"><h3 className="font-display text-xl font-semibold text-fg">New packages are being planned</h3><p className="mt-3 text-sm leading-relaxed text-muted">Published itineraries and prices will appear here. You can explore trip planning or contact our team about a getaway.</p></div>
    )}
    <div className="mt-10 flex flex-wrap justify-center gap-3"><Button href="/packages" variant="accent">Explore packages</Button><Button href="/booking?mode=custom" variant="outline">Create your own package</Button></div>
  </Section>;
}
