"use client";

import { useState } from "react";
import Button from "@/components/common/Button";
import DestinationPhoto from "@/components/common/DestinationPhoto";
import { useAuth } from "@/context/AuthContext";
import type { Region, TravelPackage } from "@/types";
import GuidedPackagePlanner from "./GuidedPackagePlanner";

export default function GuidedPackageChooser({ region, regions, packages, initialSpotId, vehicleId, onClearPlace, onBrowsePackages }: {
  region: Region; regions: Region[]; packages: TravelPackage[]; initialSpotId?: string;
  vehicleId?: number; onClearPlace: () => void; onBrowsePackages: () => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const plans = packages.filter(pkg => String(pkg.regionId) === region.id && pkg.isGuided && pkg.isBookable !== false && pkg.guidedPlan?.content.routeTree?.roots.length);
  const wanted = initialSpotId ? region.spots.find(spot => spot.id === initialSpotId) : undefined;
  const matching = wanted ? plans.filter(pkg => pkg.guidedPlan!.destinations.some(place => String(place.id) === wanted.id)) : plans;
  const active = matching.find(pkg => pkg.id === selectedId) ?? (matching.length === 1 ? matching[0] : undefined);
  const term = query.trim().toLocaleLowerCase();
  const shown = matching.filter(pkg => `${pkg.name} ${pkg.guidedPlan!.destinations.map(place => place.name).join(" ")}`.toLocaleLowerCase().includes(term));
  const photos = new Map(regions.flatMap(item => item.spots.map(spot => [Number(spot.id), spot] as const)));
  return <div className="min-w-0 space-y-5">
    {wanted && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3"><p className="text-sm text-fg">Trips visiting <strong>{wanted.name}</strong>{wanted.cityName ? ` · ${wanted.cityName}` : ""}</p><Button variant="outline" size="sm" onClick={onClearPlace}>See all routes in {region.name}</Button></div>}
    {!matching.length ? <div role="status" className="rounded-2xl border border-line bg-surface p-5 sm:p-7"><h3 className="text-lg font-semibold text-fg">{wanted ? `No guided trip visiting ${wanted.name} is published yet` : `Guided trips for ${region.name} are coming soon`}</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">This region’s places are available to explore. Custom package booking opens when a trip with its connected stops, stays, inclusions and prices is published.</p><Button onClick={onBrowsePackages} variant="outline" className="mt-4">Browse ready-made packages</Button>{user?.role === "admin" && <div className="mt-5 border-t border-line pt-4"><p className="text-sm font-semibold text-fg">Set up a guided trip</p><p className="mt-2 text-sm leading-relaxed text-muted">In Packages, add or edit a private trip. Enable its reusable plan and “approved next destinations”, add a starting point, connect the next stops and set where the trip can finish. Add the real prices and inclusions, then save it as active.</p><Button href="/admin/packages" className="mt-3" size="sm">Manage package routes</Button></div>}</div> : active ? <div className="space-y-4">{matching.length > 1 && <Button variant="outline" onClick={() => setSelectedId(null)}>Choose another trip</Button>}<GuidedPackagePlanner key={active.id} slug={active.id} name={active.name} content={active.guidedPlan!.content} basePrice={active.guidedPlan!.basePricePerPerson} destinations={active.guidedPlan!.destinations.map(place => ({ ...place, imageUrl: photos.get(place.id)?.imageUrl, cityName: photos.get(place.id)?.cityName }))} vehicleId={vehicleId} /></div> : <>
      <label className="block max-w-xl text-sm font-semibold text-fg">Find a trip or stop<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Start typing a destination…" className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-normal text-fg" /></label>
      {!shown.length && <p role="status" className="text-sm text-muted">No matching trips. Try another destination.</p>}
      <div className="grid gap-4 sm:grid-cols-2">{shown.map(pkg => <button data-ui-action="" type="button" key={pkg.id} aria-label={`Customise ${pkg.name}`} onClick={() => setSelectedId(pkg.id)} className="group min-w-0 overflow-hidden rounded-2xl border border-line bg-surface text-left transition-colors hover:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"><span className="relative block h-36"><DestinationPhoto imageUrl={pkg.imageUrl} alt={pkg.name} sizes="(max-width:640px) 100vw, 50vw" decorative /></span><span className="block p-4"><span className="block text-lg font-semibold text-fg">{pkg.name}</span><span className="mt-2 block text-sm text-muted">{pkg.duration}{pkg.durationMaxDays && pkg.durationMaxDays > pkg.duration ? `–${pkg.durationMaxDays}` : ""} days · From ₹{pkg.pricePerPerson.toLocaleString("en-IN")} / person</span><span className="mt-3 block text-sm font-semibold text-fg">Choose your stops →</span></span></button>)}</div>
    </>}
  </div>;
}
