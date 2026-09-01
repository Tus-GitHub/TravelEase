import type { Metadata } from "next";
import Section from "@/components/common/Section";
import PackagesBrowser from "@/components/packages/PackagesBrowser";
import { listPublicPackages, toCardPackage } from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Travel Packages — Jagdamba Travellers",
  description:
    "Curated multi-day trips across India — chauffeur-driven, all-inclusive, with a transparent per-person price.",
};

export default async function PackagesPage() {
  const packages = (await listPublicPackages()).map(toCardPackage);

  return (
    <Section
      bg="gray"
      eyebrow="Curated Trips"
      title="Travel Packages"
      subtitle="Chauffeur-driven multi-day journeys with a fixed route, a set vehicle and an all-inclusive per-person price."
    >
      {packages.length > 0 ? (
        <PackagesBrowser packages={packages} />
      ) : (
        <p className="text-center text-sm text-muted">
          No packages are published yet. Check back soon.
        </p>
      )}
    </Section>
  );
}
