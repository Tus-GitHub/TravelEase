"use client";

import { useState } from "react";
import Button from "@/components/common/Button";
import DestinationPhoto from "@/components/common/DestinationPhoto";
import type { DestinationCity } from "@/lib/destination-explorer";
import styles from "./DestinationMap.module.css";

export default function DestinationCityCards({ cities, ready, initialCount, onPick, lightSurface = false }: {
  cities: DestinationCity[]; ready: boolean; initialCount: number; onPick: (city: DestinationCity) => void; lightSurface?: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  return <div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Explore cities">{cities.slice(0, count).map(city => <button data-ui-action="" type="button" disabled={!ready} key={city.key} onClick={() => onPick(city)} className={`${styles.cityButton} overflow-hidden rounded-2xl border border-line bg-surface text-left text-fg`}>
      <span className="relative block aspect-[4/3] bg-surface-muted"><DestinationPhoto imageUrl={city.spots[0]?.imageUrl ?? ""} alt={city.spots[0]?.name ?? city.name} decorative sizes="(min-width:1024px) 190px, (min-width:640px) 30vw, 45vw" /></span>
      <span className="block p-3"><span className="block break-words text-sm font-semibold">{city.name}</span><span className="mt-1 block text-xs text-muted">{city.spots.length} places</span><span className="mt-2 block truncate text-[10px] text-muted">{city.spots[0]?.name}</span></span>
    </button>)}</div>
    {count < cities.length && <Button variant={lightSurface ? "outline" : "glass"} className="mt-4" disabled={!ready} onClick={() => setCount(value => value + 12)}>Show more cities ({cities.length - count})</Button>}
  </div>;
}
