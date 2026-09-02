import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import StarRating from "@/components/common/StarRating";
import PackageCard from "@/components/cards/PackageCard";
import Magnetic from "@/components/motion/Magnetic";
import Spotlight from "@/components/motion/Spotlight";
import {
  getPublicPackage,
  listPublicPackages,
  toCardPackage,
  PACKAGE_IMAGE_FALLBACK,
} from "@/lib/server/catalogue";
import { listReviewsForPackage } from "@/lib/server/reviews";
import ReviewList from "@/components/reviews/ReviewList";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const pkg = await getPublicPackage(params.id);
  return { title: pkg ? `${pkg.name} — Jagdamba Travellers` : "Package — Jagdamba Travellers" };
}

export default async function PackageDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const pkg = await getPublicPackage(params.id);
  if (!pkg) notFound();

  const nights = pkg.stops.reduce((sum, s) => sum + s.nightsHere, 0);
  const [allPkgs, reviews] = await Promise.all([
    listPublicPackages(),
    listReviewsForPackage(pkg.id),
  ]);
  const similar = allPkgs
    .filter((p) => p.regionId === pkg.regionId && p.id !== pkg.id)
    .slice(0, 3)
    .map(toCardPackage);
  const priceLabel = `₹${pkg.pricePerPerson.toLocaleString("en-IN")}`;

  return (
    <Section bg="gray">
      <Link
        href="/packages"
        className="hover-underline inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-300"
      >
        <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
        All packages
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-hover shadow-card">
          <Spotlight className="h-full w-full">
            <Image
              src={pkg.imageUrl ?? PACKAGE_IMAGE_FALLBACK}
              alt={pkg.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </Spotlight>
          <span className="absolute left-4 top-4 flex flex-wrap gap-2">
            <Badge tone="primary">{pkg.regionName}</Badge>
            {pkg.tag && <Badge tone="success">{pkg.tag}</Badge>}
          </span>
        </div>

        <div>
          <h1 className="font-display text-display-sm text-fg">{pkg.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
            {pkg.rating != null && pkg.rating > 0 && (
              <StarRating rating={pkg.rating} showValue />
            )}
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" className="h-4 w-4" /> {pkg.durationDays} days
              {nights > 0 ? ` · ${nights} nights` : ""}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="users" className="h-4 w-4" /> up to {pkg.maxPersons}
            </span>
          </div>

          <div className="mt-5 flex items-end gap-1">
            <span className="font-display text-3xl font-bold text-primary-900 dark:text-primary-300 ">
              {priceLabel}
            </span>
            <span className="pb-1 text-sm text-muted">/ person</span>
          </div>

          <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted">
            <Icon name="car" className="h-4 w-4 text-primary-600" /> {pkg.vehicleTypeTitle}
          </div>

          {pkg.highlights.length > 0 && (
            <ul className="mt-5 space-y-1.5">
              {pkg.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm text-muted">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {h}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <Magnetic>
              <Button
                href={`/booking/new?package=${pkg.slug}`}
                variant="accent"
                size="lg"
                iconRight="arrow-right"
              >
                Book This Package
              </Button>
            </Magnetic>
            <Button href="/packages" variant="outline" size="lg">
              Back to packages
            </Button>
          </div>
        </div>
      </div>

      {pkg.stops.length > 0 && (
        <div className="mt-12">
          <h2 className="font-display text-xl font-bold text-fg">Itinerary</h2>
          <ol className="mt-6 space-y-4 border-l-2 border-line pl-6">
            {pkg.stops.map((s, i) => (
              <li key={s.touristSpotId} className="relative">
                <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-display text-base font-semibold text-fg">{s.name}</span>
                  {s.tag && (
                    <span className="text-xs font-medium text-accent-600">{s.tag}</span>
                  )}
                  <span className="text-xs text-faint">
                    {s.nightsHere > 0
                      ? `${s.nightsHere} night${s.nightsHere > 1 ? "s" : ""}`
                      : "day visit"}
                  </span>
                </div>
                {s.description && (
                  <p className="mt-1 text-sm text-muted">{s.description}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <ReviewList reviews={reviews} />

      {similar.length > 0 && (
        <div className="mt-14">
          <h2 className="font-display text-xl font-bold text-fg">More in {pkg.regionName}</h2>
          <div className="mt-6">
            <Grid cols={{ base: 1, sm: 2, lg: 3 }}>
              {similar.map((p) => (
                <PackageCard key={p.id} pkg={p} />
              ))}
            </Grid>
          </div>
        </div>
      )}
    </Section>
  );
}
