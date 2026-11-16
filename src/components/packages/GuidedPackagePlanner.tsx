"use client";

import { useMemo, useState } from "react";
import Button from "@/components/common/Button";
import DestinationPhoto from "@/components/common/DestinationPhoto";
import { destinationPhotoCredit } from "@/lib/destination-photo";
import PackagePlanView from "./PackagePlanView";
import { selectPackageRoute, type PackageContent } from "@/lib/package-content";
import { mealSummary } from "@/lib/trip-plan";

interface Destination { id: number; name: string; imageUrl?: string; cityName?: string }
export default function GuidedPackagePlanner({ slug, name, content, destinations, basePrice, vehicleId }: {
  vehicleId?: number; slug: string; name: string; content: PackageContent;
  destinations: Destination[]; basePrice: number;
}) {
  const tree = content.routeTree;
  const [path, setPath] = useState<number[]>(() => tree?.roots.length === 1 ? [tree.roots[0]] : []);
  const places = useMemo(() => new Map(destinations.map(destination => [destination.id, destination])), [destinations]);
  const names = useMemo(() => new Map(destinations.map(destination => [destination.id, destination.name])), [destinations]);
  const byId = useMemo(() => new Map(tree?.nodes.map(node => [node.spotId, node]) ?? []), [tree]);
  if (!tree?.roots.length) return <p role="status" className="rounded-xl border border-line p-5 text-sm text-muted">This route is not available right now. Choose another published trip.</p>;
  let selected: ReturnType<typeof selectPackageRoute> | undefined;
  try { if (path.length) selected = selectPackageRoute(tree, path, basePrice, names, false); } catch { /* Render only currently valid connections. */ }
  const validPath = selected ? path : [];
  const last = selected ? byId.get(validPath[validPath.length - 1]) : undefined;
  const choices = last ? last.next : tree.roots;
  const href = `/booking/new?${new URLSearchParams({ package: slug, path: validPath.join(","), ...(vehicleId ? { vehicle: String(vehicleId) } : {}) })}`;

  return <section id="build-trip" className="min-w-0 scroll-mt-24 space-y-6 rounded-2xl border border-line bg-surface p-4 sm:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Your trip, one stop at a time</p><h2 className="mt-1 text-xl font-bold text-fg">{name}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Choose your next stop below. We show only the connections included in this trip, with stays, meals and price updated as you go.</p></div>
    {validPath.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Your route so far</p><ol aria-label="Selected destinations" className="flex flex-wrap items-center gap-2">{validPath.map((id, i) => <li key={id} className="flex min-w-0 items-center gap-2">{i > 0 && <span aria-hidden="true" className="text-muted">→</span>}<button data-ui-action="" type="button" onClick={() => setPath(validPath.slice(0, i + 1))} aria-label={`Change route from ${names.get(id)}`} className="min-h-11 max-w-full rounded-xl border border-line bg-surface-muted px-3 py-2 text-left text-sm font-semibold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"><span className="mr-2 text-muted">{i + 1}</span>{names.get(id)}</button></li>)}</ol></div>}
    {choices.length > 0 && <fieldset className="min-w-0"><legend className="mb-3 text-lg font-semibold text-fg">{last ? `Where next after ${names.get(last.spotId)}?` : "Where would you like to start?"}</legend><div className="grid gap-3 sm:grid-cols-2">{choices.map(id => {
      const node = byId.get(id), place = places.get(id);
      if (!node || !place) return null;
      const credit = destinationPhotoCredit(place.imageUrl);
      return <div key={id} className="min-w-0"><button data-ui-action="" data-route-choice={id} aria-label={`Choose ${place.name}`} type="button" onClick={() => setPath([...validPath, id])} className="group flex min-h-28 w-full min-w-0 items-stretch overflow-hidden rounded-2xl border border-line bg-surface text-left transition-colors hover:border-primary-500 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
        {place.imageUrl && <span className="relative w-20 shrink-0 sm:w-28"><DestinationPhoto imageUrl={place.imageUrl} alt={place.name} sizes="112px" decorative /></span>}
        <span className="min-w-0 flex-1 p-3 sm:p-4"><span className="block font-semibold text-fg">{place.name}<span aria-hidden="true" className="ml-2 text-muted">→</span></span>{place.cityName && place.cityName !== place.name && <span className="mt-1 block text-xs text-muted">{place.cityName}</span>}<span className="mt-2 block text-sm text-muted">{node.nights ? `${node.nights} ${node.nights === 1 ? "night" : "nights"}` : "Day visit"} · {node.extraPricePerPerson ? `+₹${node.extraPricePerPerson.toLocaleString("en-IN")} / person` : "Included in base price"}</span>{node.description && <span className="mt-2 line-clamp-2 block text-xs leading-relaxed text-muted">{node.description}</span>}</span>
      </button>{credit && <a className="mt-1 inline-flex min-h-11 items-center text-xs text-muted underline underline-offset-2" href={credit}>Photo credit: {place.name}</a>}</div>;
    })}</div></fieldset>}
    {selected && <div aria-live="polite" aria-atomic="true" className="rounded-2xl border border-line bg-surface-muted p-4"><p className="font-semibold text-fg">{selected.days} {selected.days === 1 ? "day" : "days"} · {selected.nights} {selected.nights === 1 ? "night" : "nights"}</p><p className="mt-1 text-xl font-bold text-fg">₹{selected.pricePerPerson.toLocaleString("en-IN")} <span className="text-sm font-normal text-muted">/ person</span></p>{mealSummary(selected.meals) && <p className="mt-2 text-sm text-muted">Included: {mealSummary(selected.meals)}</p>}<p className="mt-2 text-xs leading-relaxed text-muted">Traveller count, vehicle availability, tax and discounts are confirmed at checkout before you book.</p></div>}
    <div className="flex flex-wrap gap-3">{selected && last?.canFinish && <Button href={href} variant="accent" size="lg">{choices.length ? "Finish here & continue" : "Continue with this route"}</Button>}{validPath.length > 0 && <Button type="button" variant="outline" onClick={() => setPath(validPath.slice(0, -1))}>Change previous stop</Button>}</div>
    {last && !last.canFinish && <p role="status" className="text-sm text-muted">Choose a next destination to complete your trip.</p>}
    {selected && <details className="rounded-xl border border-line p-4"><summary className="min-h-11 cursor-pointer font-semibold text-fg">Review stays, meals &amp; inclusions</summary><div className="mt-4"><PackagePlanView content={content} selectedRoute={selected} /></div></details>}
  </section>;
}
