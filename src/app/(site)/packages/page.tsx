import type { Metadata } from "next";
import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import PackagesBrowser from "@/components/packages/PackagesBrowser";
import { listPublicPackages, toCardPackage } from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Travel Packages — Jagdamba Travellers",
  description:
    "Curated multi-day trips across India — chauffeur-driven, all-inclusive, with a transparent per-person price.",
};

export default async function PackagesPage({ searchParams }: { searchParams: { regionId?: string } }) {
  const rows = await listPublicPackages();
  const regionId = /^\d+$/.test(searchParams.regionId || '') ? Number(searchParams.regionId) : 0;
  const packages = rows.filter(p => !regionId || p.regionId === regionId).map(toCardPackage);

  return (
    <Section
      bg="gray"
      eyebrow="Curated Trips"
      title="Travel Packages"
      subtitle="Chauffeur-driven multi-day journeys with a fixed route, a set vehicle and an all-inclusive per-person price."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Looking for a place to stay alongside your journey?</p>
        <Button href="/hotels" variant="outline" size="sm" iconLeft="map-pin">Explore hotels</Button>
      </div>
      {packages.length > 0 ? (
        <PackagesBrowser packages={packages} />
      ) : (
        <p className="text-center text-sm text-muted">
          No packages are published yet. Check back soon.
        </p>
      )}
      {regionId > 0 && <div className="mt-6 text-center"><Button href="/packages" variant="outline" size="sm">View all destinations</Button></div>}
    </Section>
  );
}
