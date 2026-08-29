import Image from "next/image";
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
              : "text-slate-200 fill-current"
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
}

export default function PackageCard({ pkg }: PackageCardProps) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      {/* Image */}
      <div className="relative h-48 w-full shrink-0 overflow-hidden">
        <Image
          src={pkg.imageUrl}
          alt={pkg.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />

        {/* Tag badge */}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold tracking-wide ${tagStyles[pkg.tag]}`}
        >
          {pkg.tag}
        </span>

        {/* Duration pill */}
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 backdrop-blur-sm">
          <Icon name="calendar" className="h-3.5 w-3.5 text-primary-700" />
          {pkg.duration} Days
        </span>

        {/* Region at bottom of image */}
        <p className="absolute bottom-3 left-3 text-xs font-medium text-white/80">
          {pkg.region}
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        {/* Name */}
        <h3 className="font-display text-lg font-bold text-slate-900 leading-snug">
          {pkg.name}
        </h3>

        {/* Destination route */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {pkg.destinations.map((dest, i) => (
            <span key={dest} className="flex items-center gap-1">
              <span className="text-sm font-medium text-primary-800">{dest}</span>
              {i < pkg.destinations.length - 1 && (
                <Icon name="arrow-right" className="h-3 w-3 text-accent-500" />
              )}
            </span>
          ))}
        </div>

        {/* Highlights */}
        <ul className="mt-3 space-y-1.5">
          {pkg.highlights.slice(0, 3).map((h) => (
            <li key={h} className="flex items-start gap-2 text-sm text-slate-600">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {h}
            </li>
          ))}
        </ul>

        {/* Vehicle & capacity */}
        <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Icon name="car" className="h-4 w-4 text-primary-600" />
            {pkg.vehicleType}
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="users" className="h-4 w-4 text-primary-600" />
            Up to {pkg.maxPersons}
          </span>
        </div>

        {/* Rating + price + CTA */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Stars rating={pkg.rating} />
              <span className="text-xs font-semibold text-slate-700">
                {pkg.rating}
              </span>
              <span className="text-xs text-slate-400">
                ({pkg.reviewCount})
              </span>
            </div>
            <p className="mt-1">
              <span className="font-display text-xl font-extrabold text-primary-900">
                {formatPrice(pkg.pricePerPerson)}
              </span>
              <span className="ml-1 text-xs text-slate-400">/person</span>
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-4">
          <Button
            variant="primary"
            size="md"
            fullWidth
            iconRight="arrow-right"
            href={`/booking?package=${pkg.id}`}
          >
            Book This Package
          </Button>
        </div>
      </div>
    </div>
  );
}
