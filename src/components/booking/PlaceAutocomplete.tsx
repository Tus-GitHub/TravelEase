"use client";
import { useEffect, useRef, useState } from "react";
import type { RoutePoint } from "@/lib/booking-route";
type Place = RoutePoint & { label: string };

export default function PlaceAutocomplete({ id, label, point, value, onChoose }: {
  id: string; label: string; point: RoutePoint | null; value?: string;
  onChoose: (point: RoutePoint | null, label?: string) => void;
}) {
  const [query, setQuery] = useState(point ? value ?? "Selected map point" : "");
  const [places, setPlaces] = useState<Place[]>([]), [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const cache = useRef(new Map<string, Place[]>());
  useEffect(() => { if (point) setQuery(value || "Selected map point"); }, [point, value]);
  useEffect(() => {
    setError(""); setPlaces([]); setActive(0); setBusy(false);
    if (point || query.trim().length < 3) { setBusy(false); return; }
    const controller = new AbortController(), key = query.trim().toLowerCase();
    let retry: ReturnType<typeof setTimeout> | undefined;
    async function search(retried = false) {
      if (controller.signal.aborted) return;
      retry = undefined;
      if (cache.current.has(key)) { setPlaces(cache.current.get(key)!); setOpen(true); setBusy(false); return; }
      setBusy(true);
      try {
        const response = await fetch("/api/booking-map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suggest", query }), signal: controller.signal });
        const data = await response.json(); if (controller.signal.aborted) return;
        const after = Number(response.headers.get("Retry-After"));
        if (response.status === 429 && !retried && after > 0 && after <= 3) { retry = setTimeout(() => void search(true), after * 1000); return; }
        if (!response.ok) throw new Error(data.error || "Suggestions are unavailable. Choose a point on the map.");
        cache.current.set(key, data.results); if (cache.current.size > 30) cache.current.delete(cache.current.keys().next().value!);
        setPlaces(data.results); setOpen(true);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Choose a point on the map instead."); }
      finally { if (!controller.signal.aborted && !retry) setBusy(false); }
    }
    const timer = setTimeout(() => void search(), 1200);
    return () => { clearTimeout(timer); if (retry) clearTimeout(retry); controller.abort(); };
  }, [query, point]);
  function choose(place: Place) { setQuery(place.label); setOpen(false); setPlaces([]); onChoose(place, place.label); }
  return <div className="relative min-w-0">
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">{label}</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open && places.length > 0} aria-controls={`${id}-options`} aria-activedescendant={open && places.length ? `${id}-option-${active}` : undefined}
      autoComplete="off" maxLength={150} placeholder="Start typing a city, area or landmark" value={query}
      className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-3 text-base text-fg"
      onChange={e => { setQuery(e.target.value); setOpen(true); onChoose(null); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={e => {
        if (e.key === "Escape") setOpen(false);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setActive(v => Math.max(0, Math.min(places.length - 1, v + (e.key === "ArrowDown" ? 1 : -1)))); }
        if (e.key === "Enter") { e.preventDefault(); if (open && places[active]) choose(places[active]); }
      }} />
    {open && places.length > 0 && <ul id={`${id}-options`} role="listbox" aria-label={`${label} suggestions`} className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
      {places.map((place, i) => <li key={`${place.lat},${place.lng},${i}`} id={`${id}-option-${i}`} role="option" aria-selected={active === i} onMouseDown={e => e.preventDefault()} onClick={() => choose(place)} className={`min-h-11 cursor-pointer rounded-lg px-3 py-3 text-sm text-fg ${active === i ? "bg-surface-hover" : "hover:bg-surface-hover"}`}>{place.label}</li>)}
    </ul>}
    <p role="status" aria-live="polite" className="mt-1 min-h-4 text-xs text-muted">{busy ? "Finding places…" : error || (!point && query.trim().length >= 3 && open && !places.length ? "Suggestions appear here. You can also choose on the map." : point ? "Location selected" : "")}</p>
  </div>;
}
