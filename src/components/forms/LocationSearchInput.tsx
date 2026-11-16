"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import ControlPopover from "@/components/controls/ControlPopover";
import type { RoutePoint } from "@/lib/booking-route";

export interface LocationSuggestion {
  label: string; name?: string; city?: string; state?: string; pincode?: string;
  lat?: number; lng?: number;
}
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onSelect"> & {
  value: string; onValueChange: (value: string) => void;
  onChoose: (place: LocationSuggestion) => void;
  localOptions?: LocationSuggestion[]; external?: boolean; queryContext?: string;
  mode?: "place" | "state" | "city";
};
const resultsCache = new Map<string, LocationSuggestion[]>();
export function locationPoint(place: LocationSuggestion): RoutePoint | null {
  return typeof place.lat === "number" && Number.isFinite(place.lat) && Math.abs(place.lat) <= 90 && typeof place.lng === "number" && Number.isFinite(place.lng) && Math.abs(place.lng) <= 180 ? { lat: place.lat, lng: place.lng } : null;
}
export const locationName = (place: LocationSuggestion) => place.name || place.label.split(",")[0].trim();
export const sameLocationName = (a: string, b: string) => a.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase() === b.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();

/** Public-place suggestions only. Manual text remains usable if the free service is unavailable. */
export default function LocationSearchInput({ value, onValueChange, onChoose, localOptions = [], external = true, queryContext = "", mode = "place", id: suppliedId, disabled, className = "", ...inputProps }: Props) {
  const generated = useId(), id = suppliedId || `place-${generated}`, listId = `${id}-options`;
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const input = useRef<HTMLInputElement>(null), suppress = useRef<string | null>(value);
  const [open, setOpen] = useState(false), [results, setResults] = useState<LocationSuggestion[]>([]), [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const query = value.trim(), local = localOptions.filter(place => place.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 12);
  const combined = [...local, ...results.filter(place => !local.some(item => sameLocationName(item.label, place.label)))];
  const options = mode === "state" ? combined.filter((place, index) => combined.findIndex(item => sameLocationName(item.state || locationName(item), place.state || locationName(place))) === index) : combined;
  const hasLocalState = mode === "state" && local.length > 0;
  useEffect(() => {
    setResults([]); setActive(0); setMessage(""); setBusy(false);
    if (!open || disabled || !external || hasLocalState || query.length < 3 || suppress.current === value) return;
    const controller = new AbortController(); let retry: ReturnType<typeof setTimeout> | undefined;
    const text = [query, queryContext.trim()].filter(Boolean).join(", ").slice(0, 150), key = text.toLocaleLowerCase();
    async function search(retried = false) {
      retry = undefined; if (controller.signal.aborted) return;
      if (resultsCache.has(key)) { setResults(resultsCache.get(key)!); return; }
      setBusy(true);
      try {
        const response = await fetch("/api/booking-map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suggest", query: text }), signal: controller.signal });
        const data = await response.json(); if (controller.signal.aborted) return;
        const after = Number(response.headers.get("Retry-After"));
        if (response.status === 429 && !retried && after > 0 && after <= 3) { retry = setTimeout(() => void search(true), after * 1000); return; }
        if (!response.ok) throw new Error(data.error || "Suggestions unavailable. You can enter the place manually or choose it on the map.");
        const places = Array.isArray(data.results) ? data.results.filter((p: LocationSuggestion) => typeof p.label === "string" && locationPoint(p)) : [];
        resultsCache.set(key, places); if (resultsCache.size > 60) resultsCache.delete(resultsCache.keys().next().value!);
        setResults(places); if (!places.length) setMessage("No suggestions found. Try a nearby city or choose on the map.");
      } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Enter the location manually."); }
      finally { if (!controller.signal.aborted && !retry) setBusy(false); }
    }
    const timer = setTimeout(() => void search(), 1200);
    return () => { clearTimeout(timer); if (retry) clearTimeout(retry); controller.abort(); };
  }, [query, value, queryContext, open, external, disabled, hasLocalState]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const option = document.getElementById(`${listId}-${active}`), list = option?.parentElement;
    if (!option || !list) return;
    const item = option.getBoundingClientRect(), bounds = list.getBoundingClientRect();
    if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top;
    else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
  }, [active, open, listId]);
  function choose(place: LocationSuggestion) {
    if (disabled || input.current?.matches(":disabled")) return;
    const text = mode === "state" ? place.state || locationName(place) : mode === "city" ? place.city || locationName(place) : locationName(place);
    suppress.current = text; onValueChange(text); onChoose(place); setOpen(false); setResults([]); setMessage(""); input.current?.focus();
  }
  return <span className="block min-w-0">
    <input {...inputProps} ref={input} id={id} disabled={disabled || !ready} value={value} maxLength={inputProps.maxLength ?? 150} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open && (options.length > 0 || busy || Boolean(message))} aria-controls={listId} aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
      className={`min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-fg ${className}`}
      onChange={event => { suppress.current = null; onValueChange(event.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={event => {
        if (event.key === "Escape" && open && (options.length > 0 || busy || message)) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setOpen(true); setActive(index => Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))); }
        if (event.key === "Enter" && open && options.length) { event.preventDefault(); choose(options[active] ?? options[0]); }
      }} />
    {open && (options.length > 0 || busy || message) && <ControlPopover anchor={input} onClose={() => setOpen(false)}><div id={listId} role="listbox" aria-label={`${inputProps["aria-label"] || "Location"} suggestions`} className="control-options">{options.map((place, index) => <div key={`${place.label}-${index}`} id={`${listId}-${index}`} role="option" aria-selected={active === index} onPointerDown={event => event.preventDefault()} onMouseDown={event => event.preventDefault()} onClick={() => choose(place)} className={`min-h-11 cursor-pointer rounded-lg px-3 py-3 text-sm text-fg ${active === index ? "bg-surface-hover" : "hover:bg-surface-hover"}`}><span className="block font-medium">{mode === "state" ? place.state || locationName(place) : mode === "city" ? place.city || locationName(place) : locationName(place)}</span><span className="mt-1 block text-xs leading-relaxed text-muted">{place.label}</span></div>)}</div>{(busy || message) && <p role="status" aria-live="polite" className="border-t border-line px-3 py-3 text-xs leading-relaxed text-muted">{busy ? "Finding places…" : message}</p>}</ControlPopover>}
  </span>;
}
