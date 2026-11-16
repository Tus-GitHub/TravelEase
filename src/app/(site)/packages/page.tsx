import type { Metadata } from "next";
import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import PackagesBrowser from "@/components/packages/PackagesBrowser";
import { listPublicPackages, toCardPackage } from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Travel Packages — Jagdamba Travellers",
  description:
    "Ready-made getaways and guided custom packages. Explore the itinerary, included stays and meals, and per-person prices.",
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
      subtitle="Start with a planned getaway or customise an approved route. Each package shows its itinerary, price, inclusions and additional costs."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Want to shape your own itinerary or join a weekend group?</p>
        <div className="flex flex-wrap gap-3"><Button href="/booking?mode=custom" variant="accent" size="sm">Create your own package</Button><Button href="/weekend-trips" variant="outline" size="sm">Weekend trips</Button></div>
      </div>
      {packages.length > 0 ? (
        <PackagesBrowser packages={packages} />
      ) : (
        <p className="text-center text-sm text-muted">
          New packages are being planned. Contact our team about a complete getaway, or explore custom trip planning above.
        </p>
      )}
      {regionId > 0 && <div className="mt-6 text-center"><Button href="/packages" variant="outline" size="sm">View all destinations</Button></div>}
    </Section>
  );
}
