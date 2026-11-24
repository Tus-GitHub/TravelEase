import Image from "next/image";
import Link from "next/link";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import type { TravelPackage, PackageTag } from "@/types";

// ─── Tag badge styles ─────────────────────────────────────────────────────────

const tagStyles: Record<PackageTag, string> = {
  Popular:     "bg-accent-500 text-white",
  "Best Value":"bg-emerald-500 text-white",
  Premium:     "bg-primary-700 text-white",
  Adventure:   "bg-orange-500 text-white",
};

// ─── Star rating ──────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 ${
            i < Math.round(rating)
              ? "text-accent-500 fill-current"
              : "text-line fill-current"
          }`}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ─── Price formatter ──────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

// ─── PackageCard ──────────────────────────────────────────────────────────────

interface PackageCardProps {
  pkg: TravelPackage;
  vehicleId?: number;
}

export default function PackageCard({ pkg, vehicleId }: PackageCardProps) {
  const vehicleQuery = vehicleId ? `?vehicle=${vehicleId}` : "";
  const detailHref = `/packages/${pkg.id}${vehicleQuery}`;
  const bookHref = `${detailHref}${pkg.isGuided ? "#build-trip" : "#book-package"}`;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-line/80 bg-surface shadow-[0_14px_40px_-18px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-400/40 hover:shadow-[0_24px_60px_-16px_rgba(245,158,11,0.16)] focus-within:ring-2 focus-within:ring-accent-500">
      <Link
        href={detailHref}
        aria-label={`View ${pkg.name} details`}
        className="absolute inset-0 z-10 rounded-3xl focus-visible:outline-none"
      />
      {/* Image */}
      <div className="relative h-52 w-full shrink-0 overflow-hidden">
        <Image
          src={pkg.imageUrl}
          alt={pkg.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />

        {/* Tag badge */}
        <span
          className={`absolute left-3.5 top-3.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm ${tagStyles[pkg.tag]}`}
        >
          {pkg.tag}
        </span>

        {/* Duration pill */}
        <span className="absolute right-3.5 top-3.5 flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/75 px-3 py-1 text-xs font-semibold text-amber-200 backdrop-blur-md">
          <Icon name="calendar" className="h-3.5 w-3.5 text-amber-400" />
          {pkg.duration}{pkg.durationMaxDays&&pkg.durationMaxDays>pkg.duration?`–${pkg.durationMaxDays}`:""} Days
        </span>

        {/* Region at bottom of image */}
        <p className="absolute bottom-3 left-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/90">
          {pkg.region}
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        {/* Name */}
        <h3 className="font-display text-lg font-bold text-fg leading-snug transition-colors group-hover:text-accent-600 dark:group-hover:text-amber-300">
          {pkg.name}
        </h3>

        {/* Destination route */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {pkg.destinations.map((dest, i) => (
            <span key={dest} className="flex items-center gap-1">
              <span className="text-sm font-medium text-primary-800 dark:text-primary-300">{dest}</span>
              {i < pkg.destinations.length - 1 && (
                <Icon name="arrow-right" className="h-3 w-3 text-accent-500" />
              )}
            </span>
          ))}
        </div>

        {/* Highlights */}
        <ul className="mt-3 space-y-1.5">
          {pkg.highlights.slice(0, 3).map((h) => (
            <li key={h} className="flex items-start gap-2 text-sm text-muted">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {h}
            </li>
          ))}
        </ul>

        {/* Vehicle & capacity */}
        <div className="mt-4 flex items-center gap-4 border-t border-line-subtle pt-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <Icon name="car" className="h-4 w-4 text-primary-600" />
            {pkg.vehicleType}
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="users" className="h-4 w-4 text-primary-600" />
            Up to {pkg.maxPersons} seats
          </span>
        </div>

        {/* Rating + price + CTA */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            {pkg.reviewCount > 0 && pkg.rating > 0 ? (
              <div className="flex items-center gap-1.5">
                <Stars rating={pkg.rating} />
                <span className="text-xs font-semibold text-fg">
                  {pkg.rating}
                </span>
                <span className="text-xs text-faint">
                  ({pkg.reviewCount})
                </span>
              </div>
            ) : (
              <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                Curated Route
              </span>
            )}
            <p className="mt-1.5">
              <span className="font-display text-xl font-extrabold text-primary-900 dark:text-amber-300">
                {pkg.isGuided?"From ":""}{formatPrice(pkg.pricePerPerson)}
              </span>
              <span className="ml-1 text-xs text-faint">/ vehicle</span>
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="relative z-20 mt-4">
          <Button
            variant="primary"
            size="md"
            fullWidth
            iconRight="arrow-right"
            href={bookHref}
            disabled={pkg.isBookable === false}
          >
            {pkg.isBookable === false
              ? "Temporarily unavailable"
              : pkg.isGuided
                ? "Build this trip"
                : "Book This Package"}
          </Button>
        </div>
      </div>
    </div>
  );
}
