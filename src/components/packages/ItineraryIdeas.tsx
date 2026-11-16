"use client";
import Select from "@/components/controls/Select";


import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/common/Button";
import BrandedDialog from "@/components/common/BrandedDialog";
import Icon from "@/components/common/Icon";
import { useAuth } from "@/context/AuthContext";
import { ITINERARY_INTERESTS, validateSuggestedIds, type ItineraryInterest } from "@/lib/itinerary-suggestions";
import type { Region, TouristSpot } from "@/types";

function SpotThumbnail({ spot, index }: { spot: TouristSpot; index: number }) {
  const [failed, setFailed] = useState(false);
  return <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
    <Icon name="map-pin" className="h-7 w-7 text-faint" />
    {!failed && <Image src={spot.imageUrl} alt="" fill sizes="80px" className="object-cover" onError={() => setFailed(true)} />}
    <span className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-950 text-xs font-bold text-accent-300">{index + 1}</span>
  </div>;
}

export default function ItineraryIdeas({ region, selected, onApply }: {
  region: Region; selected: TouristSpot[]; onApply: (spots: TouristSpot[]) => void;
}) {
  const { user } = useAuth();
  const countId = useId();
  const [interests, setInterests] = useState<ItineraryInterest[]>([]);
  const maxCount = Math.min(5, region.spots.length);
  const minCount = Math.max(2, selected.length);
  const [stopCount, setStopCount] = useState(Math.max(minCount, Math.min(3, maxCount)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<TouristSpot[] | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function suggest() {
    if (busy) return;
    setBusy(true); setError(""); setSuggestion(null);
    const abort = new AbortController(); controller.current = abort;
    const input = { regionId: Number(region.id), stopCount, keepIds: selected.map(spot => Number(spot.id)), interests };
    try {
      const response = await fetch("/api/itineraries/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Itinerary ideas are unavailable. Please try again.");
      const next = data.suggestion?.spots as TouristSpot[] | undefined;
      if (data.suggestion?.regionId !== input.regionId || !Array.isArray(next) || next.some(spot =>
        !spot || typeof spot.id !== "string" || [spot.name, spot.tag, spot.description, spot.imageUrl].some(value => typeof value !== "string"))) {
        throw new Error("Could not read this itinerary. Your choices have not changed.");
      }
      validateSuggestedIds({ orderedIds: next.map(spot => Number(spot.id)) }, input, region.spots.map(spot => Number(spot.id)));
      if (!abort.signal.aborted) setSuggestion(next);
    } catch (reason) {
      if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "Itinerary ideas are unavailable.");
    } finally { if (!abort.signal.aborted) setBusy(false); }
  }

  return <>
    <div className="mb-8 overflow-hidden rounded-3xl border border-line bg-surface shadow-sm" aria-label="AI itinerary ideas">
      <div className="relative overflow-hidden bg-primary-950 px-5 py-5 text-white sm:px-7">
        <div aria-hidden className="absolute -right-8 -top-16 h-48 w-48 rounded-full border-[28px] border-white/5" />
        <div className="relative flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent-300/25 bg-accent-300/10 text-accent-300"><Icon name="star" className="h-5 w-5" /></span>
          <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-300">A little inspiration</p><h3 className="font-display text-xl font-semibold">Your trip, with a little help from AI</h3><p className="mt-2 max-w-xl text-sm leading-6 text-white/70">Discover a combination of stops in {region.name}, shaped around what you enjoy.</p></div>
        </div>
      </div>
      <div className="space-y-5 p-5 sm:p-7">
        <fieldset disabled={busy || !user}>
          <legend className="mb-3 text-sm font-semibold text-fg">What draws you in? <span className="font-normal text-muted">Pick up to three</span></legend>
          <div className="flex flex-wrap gap-2">{ITINERARY_INTERESTS.map(interest => {
            const active = interests.includes(interest);
            return <button data-ui-action="" key={interest} type="button" aria-pressed={active} disabled={!active && interests.length >= 3}
              onClick={() => { setInterests(active ? interests.filter(value => value !== interest) : [...interests, interest]); setError(""); }}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-40 ${active ? "border-accent-400 bg-accent-100 text-primary-950 dark:bg-accent-400" : "border-line bg-surface text-muted hover:border-accent-400 hover:text-fg"}`}>{interest}</button>;
          })}</div>
        </fieldset>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 flex-1">
            <label htmlFor={countId} className="mb-2 block text-sm font-semibold text-fg">Stops in your itinerary</label>
            <Select id={countId} value={stopCount} disabled={busy || !user || maxCount < 2} onChange={event => { setStopCount(Number(event.target.value)); setError(""); }}
              className="w-36 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50">
              {Array.from({ length: Math.max(0, maxCount - minCount + 1) }, (_, index) => minCount + index).map(count => <option key={count} value={count}>{count} stops</option>)}
            </Select>
          </div>
          <Button type="button" variant="accent" loading={busy} disabled={busy || !user || maxCount < minCount} iconLeft="star" onClick={() => void suggest()}>Find itinerary ideas</Button>
        </div>
        <div className="border-t border-line pt-4 text-xs leading-5 text-muted" aria-live="polite">
          {!user ? <p><Link href="/login?redirect=/%23build-package" className="font-semibold text-fg underline underline-offset-2">Sign in</Link> for AI ideas, or choose your stops on the map below.</p>
            : maxCount < 2 ? <p>This region needs at least two available stops for an itinerary idea.</p>
            : <p>{busy ? "Finding a few places you might love…" : selected.length ? `Your ${selected.length} selected ${selected.length === 1 ? "stop stays" : "stops stay"} in the suggestion. Preview before making a change.` : "Only places from our catalogue. Nothing is saved or booked until you choose."}</p>}
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      </div>
    </div>
    {suggestion && <BrandedDialog title={`An idea for ${region.name}`} description="Suggested by AI. Every place below comes from our tourist-spot catalogue." onClose={() => setSuggestion(null)}>
      <div className="space-y-6 p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-primary-950 px-3 py-1.5 font-semibold text-accent-300">{suggestion.length} stops</span>{interests.map(interest => <span key={interest} className="rounded-full border border-line px-3 py-1.5 text-muted">{interest}</span>)}</div>
        <ol className="space-y-3">{suggestion.map((spot, index) => <li key={spot.id} className="flex gap-3 rounded-2xl border border-line p-3 sm:gap-4 sm:p-4">
          <SpotThumbnail spot={spot} index={index} />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="break-words font-semibold text-fg">{spot.name}</p>{selected.some(value => value.id === spot.id) && <span className="text-xs font-medium text-muted">Your pick</span>}</div>{spot.tag && <p className="mt-1 text-xs font-semibold text-accent-700 dark:text-accent-300">{spot.tag}</p>}{spot.description && <p className="mt-2 line-clamp-3 break-words text-sm leading-5 text-muted">{spot.description}</p>}</div>
        </li>)}</ol>
        <p className="rounded-2xl bg-surface-muted p-4 text-xs leading-5 text-muted">An itinerary idea, with time to make it yours. Review the stop order next; travel times, opening hours and availability are not checked here. You can compare road routes separately and review your price before booking.</p>
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5"><Button type="button" variant="outline" onClick={() => setSuggestion(null)}>Keep my choices</Button><Button type="button" variant="accent" iconRight="arrow-right" onClick={() => onApply(suggestion)}>Use these stops</Button></div>
      </div>
    </BrandedDialog>}
  </>;
}
