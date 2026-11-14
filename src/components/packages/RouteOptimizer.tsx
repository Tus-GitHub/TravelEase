"use client";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/common/Button";
import BrandedDialog from "@/components/common/BrandedDialog";
import Icon from "@/components/common/Icon";
import { useAuth } from "@/context/AuthContext";
import type { TouristSpot } from "@/types";
import type { RouteSuggestion } from "@/lib/route-optimization";

const duration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
};

export default function RouteOptimizer({ spots, onApply }: { spots: TouristSpot[]; onApply: (spots: TouristSpot[]) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<RouteSuggestion | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function suggest() {
    setBusy(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch("/api/routes/optimize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spotIds: spots.map(s => Number(s.id)) }), signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not suggest a route. Try again.");
      const next = data.suggestion as RouteSuggestion;
      // Only accept a permutation of the current route, with the endpoints preserved.
      const ids = spots.map(s => Number(s.id));
      if (!next || JSON.stringify(next.originalIds) !== JSON.stringify(ids) ||
          !Array.isArray(next.orderedIds) || next.orderedIds.length !== ids.length || new Set(next.orderedIds).size !== ids.length ||
          next.orderedIds.some(id => !ids.includes(id)) || next.orderedIds[0] !== ids[0] || next.orderedIds.at(-1) !== ids.at(-1) ||
          !Number.isFinite(next.originalSeconds) || !Number.isFinite(next.suggestedSeconds) || next.suggestedSeconds < 0 || next.suggestedSeconds > next.originalSeconds) throw new Error("Could not read the route suggestion. Your order has not changed.");
      if (!abort.signal.aborted) setSuggestion(next);
    } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Route suggestions are unavailable."); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  }
  const changed = suggestion && suggestion.originalIds.some((id, i) => id !== suggestion.orderedIds[i]);
  return <>
    <div className="mb-6 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-sm"><p className="flex items-center gap-2 font-semibold text-fg"><Icon name="location" className="h-5 w-5 text-accent-500" />A smoother route</p><p className="mt-1 text-sm leading-6 text-muted">Compare road travel times while keeping your first and last stops fixed.</p></div>
        <Button type="button" size="sm" variant="outline" loading={busy} disabled={!user || spots.length < 4} onClick={() => void suggest()}>Suggest route</Button>
      </div>
      <p className="mt-3 text-xs text-faint">{!user ? "Sign in to get a route suggestion, or continue arranging stops manually." : spots.length < 4 ? "Add at least four stops to compare different orders between your start and finish." : "Preview the suggestion before applying it. Your booking price will not change here."}</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    </div>
    {suggestion && <BrandedDialog title={changed ? "Your suggested route" : "Your route is already a good fit"} description="Start and finish stay the same. Estimates exclude visits, breaks and live traffic." onClose={() => setSuggestion(null)}>
      <div className="space-y-6 p-5 sm:p-8">
        <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-surface-muted p-4"><p className="text-xs text-muted">Current driving time</p><p className="mt-1 font-display text-xl font-bold text-fg">{duration(suggestion.originalSeconds)}</p></div><div className="rounded-2xl border border-accent-400/30 bg-accent-50 p-4 dark:bg-accent-950/20"><p className="text-xs text-muted">Suggested driving time</p><p className="mt-1 font-display text-xl font-bold text-fg">{duration(suggestion.suggestedSeconds)}</p></div></div>
        <ol className="space-y-3">{suggestion.orderedIds.map((id, i) => <li key={id} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-950 font-bold text-accent-300">{i + 1}</span><span className="min-w-0 flex-1 break-words font-semibold text-fg">{spots.find(s => Number(s.id) === id)?.name}</span>{(i === 0 || i === spots.length - 1) && <span className="text-xs text-muted">{i === 0 ? "Start" : "Finish"}</span>}</li>)}</ol>
        <p className="text-xs leading-5 text-muted">Driving-car estimates are for itinerary planning, not vehicle-specific navigation. Road restrictions and conditions may vary. Routing: <a href="https://openrouteservice.org" target="_blank" rel="noreferrer" className="underline">openrouteservice by HeiGIT</a> · Map data © OpenStreetMap contributors.</p>
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5"><Button type="button" variant="outline" onClick={() => setSuggestion(null)}>Keep my order</Button>{changed && <Button type="button" variant="accent" onClick={() => { onApply(suggestion.orderedIds.map(id => spots.find(s => Number(s.id) === id)!)); setSuggestion(null); }}>Use suggested route</Button>}</div>
      </div>
    </BrandedDialog>}
  </>;
}
