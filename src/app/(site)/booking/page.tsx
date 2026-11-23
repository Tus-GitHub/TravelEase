import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Button from "@/components/common/Button";
import PackageBuilder from "@/components/sections/PackageBuilder";
import { getPublicVehicle, listPublicPackages, listPublicRegions, listPublicVehicles, toCardPackage, toBuilderRegion } from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan your trip — Jagdamba Travellers", description: "Choose a ready-made travel package, join a weekend group or create your own itinerary." };

export default async function BookingPage({ searchParams }: { searchParams: { vehicle?: string; mode?: string; region?: string; spot?: string } }) {
  if (searchParams.vehicle && !/^[1-9]\d{0,8}$/.test(searchParams.vehicle)) notFound();
  const [vehicle, rows, regions, availableVehicles] = await Promise.all([
    searchParams.vehicle ? getPublicVehicle(Number(searchParams.vehicle)) : null,
    listPublicPackages(), listPublicRegions(), listPublicVehicles({ availableOnly: true }),
  ]);
  if (searchParams.vehicle && !vehicle) notFound();
  const rateByType = new Map<string, { label: string; minPricePerDay: number; maxSeats: number }>();
  for (const v of availableVehicles) {
    const existing = rateByType.get(v.typeSlug);
    if (!existing) {
      rateByType.set(v.typeSlug, { label: v.typeTitle, minPricePerDay: v.pricePerDay, maxSeats: v.seatingCapacity });
    } else {
      existing.minPricePerDay = Math.min(existing.minPricePerDay, v.pricePerDay);
      existing.maxSeats = Math.max(existing.maxSeats, v.seatingCapacity);
    }
  }
  const vehicleRates = Array.from(rateByType.values()).sort((a, b) => a.minPricePerDay - b.minPricePerDay);
  const packages = rows.filter(pkg => !vehicle || pkg.vehicleTypeSlug === vehicle.typeSlug).map(toCardPackage);
  return <main className="bg-canvas pb-12 pt-24 text-fg">
    <div className="section-container pb-5 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Plan your getaway</p>
      <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{vehicle ? `Travel with ${vehicle.name}` : "Choose your trip"}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">Choose a package, create your own route or book a point-to-point journey. Review your quote before confirming.</p>
      {vehicle && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-muted px-4 py-3"><p className="text-sm font-semibold">{vehicle.name} · {vehicle.seatingCapacity} seats</p><Button href="/booking" variant="ghost" size="sm">Change vehicle</Button></div>}
    </div>
    <PackageBuilder key={`${vehicle?.id ?? "any"}-${searchParams.mode ?? "packages"}-${searchParams.region??""}-${searchParams.spot??""}`} compact packages={packages} regions={regions.map(toBuilderRegion)} vehicleRates={vehicleRates} showTransfer initialRegionId={searchParams.region} initialSpotId={searchParams.spot} initialMode={searchParams.mode === "transfer" ? "transfer" : searchParams.mode === "custom" ? "custom" : "packages"} selectedVehicle={vehicle ? { id: vehicle.id, name: vehicle.name, typeSlug: vehicle.typeSlug, typeTitle: vehicle.typeTitle, pricePerDay: vehicle.pricePerDay } : undefined} />
  </main>;
}
