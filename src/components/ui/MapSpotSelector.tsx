"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import type { Region, TouristSpot } from "@/types";
const CatalogueSpotMap = dynamic(() => import("@/components/packages/CatalogueSpotMap"), { ssr: false, loading: () => <p role="status" className="text-sm text-muted">Loading destination map…</p> });
export interface MapSpotSelectorProps { region: Region; selected: TouristSpot[]; onToggle: (spot: TouristSpot) => void; maxSpots?: number }
export default function MapSpotSelector({ region, selected, onToggle, maxSpots = 5 }: MapSpotSelectorProps) {
  const [query, setQuery] = useState(""), [showMap, setShowMap] = useState(false);
  const shown = region.spots.filter(spot => `${spot.name} ${spot.cityName || ""} ${spot.tag}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const mapped = region.spots.some(spot => typeof spot.latitude === "number" && typeof spot.longitude === "number");
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><label className="min-w-0 flex-1 text-sm font-semibold text-fg">Find a destination<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Type a place, city or activity…" className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-normal text-fg" /></label><Button variant="outline" iconLeft="map-pin" disabled={!mapped} onClick={() => setShowMap(!showMap)}>{showMap ? "Hide map" : "Choose on map"}</Button></div>
    <p role="status" className="text-sm text-muted">{selected.length} of {maxSpots} destinations selected. Select at least two to plan your route.</p>
    {!mapped && <p className="text-xs text-muted">Map selection becomes available when destination pins are published. You can select all listed places below.</p>}
    {showMap && mapped && <CatalogueSpotMap spots={region.spots} selected={selected.map(spot => spot.id)} onToggle={onToggle} maxSpots={maxSpots} />}
    <div className="grid gap-3 sm:grid-cols-2">{shown.map(spot => { const chosen = selected.some(item => item.id === spot.id); return <button data-ui-action="" type="button" key={spot.id} aria-pressed={chosen} disabled={!chosen && selected.length >= maxSpots} onClick={() => onToggle(spot)} className={`min-h-24 rounded-2xl border p-4 text-left transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${chosen ? "border-accent-500 bg-accent-500/10" : "border-line bg-surface hover:border-primary-500"}`}><span className="flex items-start justify-between gap-3 font-semibold text-fg"><span>{spot.name}</span><Icon name={chosen ? "check" : "map-pin"} className="h-5 w-5 shrink-0" /></span><span className="mt-1 block text-xs text-muted">{[spot.cityName, spot.tag].filter(Boolean).join(" · ")}</span>{spot.description && <span className="mt-2 line-clamp-2 block text-sm text-muted">{spot.description}</span>}</button>; })}</div>
    {!shown.length && <p role="status" className="rounded-xl border border-line p-4 text-sm text-muted">No published destinations match. Try another place name.</p>}
  </div>;
}
