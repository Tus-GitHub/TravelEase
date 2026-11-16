import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import PackageBuilder from "@/components/sections/PackageBuilder";
import { getPublicVehicle, listPublicPackages, listPublicRegions, toCardPackage, toBuilderRegion } from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan your trip — Jagdamba Travellers", description: "Choose a ready-made travel package, join a weekend group or create your own itinerary." };

export default async function BookingPage({ searchParams }: { searchParams: { vehicle?: string; mode?: string } }) {
  if (searchParams.vehicle && !/^[1-9]\d{0,8}$/.test(searchParams.vehicle)) notFound();
  const [vehicle, rows, regions] = await Promise.all([
    searchParams.vehicle ? getPublicVehicle(Number(searchParams.vehicle)) : null,
    listPublicPackages(), listPublicRegions(),
  ]);
  if (searchParams.vehicle && !vehicle) notFound();
  const packages = rows.filter(pkg => !vehicle || pkg.vehicleTypeSlug === vehicle.typeSlug).map(toCardPackage);
  return <>
    <Section bg="white" eyebrow="Your next getaway" title={vehicle ? `Plan a trip with ${vehicle.name}` : "A whole trip, planned around you"} subtitle="Choose a ready-made itinerary or create your own package. Review the included stays, meals, activities and any extra costs before booking.">
      {vehicle && <div className="mb-6 rounded-2xl border border-line bg-surface p-5 text-fg"><p className="font-semibold">{vehicle.name} · {vehicle.seatingCapacity} seats</p><p className="mt-2 text-sm text-muted">Showing packages for this vehicle type. Your selected vehicle is carried into checkout; availability is checked for your dates.</p><Button href="/booking" variant="outline" size="sm" className="mt-3">Explore without this vehicle</Button></div>}
      <div className="flex flex-wrap gap-3"><Button href="#build-package" variant="accent">Choose or create a package</Button><Button href="/weekend-trips" variant="outline">Join a weekend group</Button></div>
      <p className="mt-4 text-sm text-muted">Weekend groups use the vehicle assigned to their departure.</p>
    </Section>
    <PackageBuilder key={`${vehicle?.id ?? "any"}-${searchParams.mode ?? "packages"}`} packages={packages} regions={regions.map(toBuilderRegion)} initialMode={searchParams.mode === "custom" ? "custom" : "packages"} selectedVehicle={vehicle ? { id: vehicle.id, name: vehicle.name, typeSlug: vehicle.typeSlug, typeTitle: vehicle.typeTitle } : undefined} />
    <Section bg="gray" eyebrow="Just need transport?" title="Point-to-point travel is available too" subtitle="For a pickup and drop without a holiday package, use our separate transfer booking. Any applicable empty-return charge is shown before confirmation.">
      <Button href={vehicle ? `/booking/new?vehicle=${vehicle.id}&type=point_to_point` : "/booking/new?type=point_to_point"} variant="outline">Book a point-to-point transfer</Button>
    </Section>
  </>;
}
