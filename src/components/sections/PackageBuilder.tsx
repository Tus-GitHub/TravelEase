"use client";
import { Suspense, useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import DestinationPhoto from "@/components/common/DestinationPhoto";
import AnimateInView from "@/components/common/AnimateInView";
import PackageCard from "@/components/cards/PackageCard";
import CustomerRoutePlanner, { type VehicleRateHint } from "@/components/packages/CustomerRoutePlanner";
import type { Region, TravelPackage } from "@/types";
import { cmsHeading, type CmsSection } from "@/lib/cms";
const BookingFlow = dynamic(() => import("@/components/booking/BookingFlow"), { loading: () => <p role="status" className="text-center text-sm text-muted">Loading transfer booking…</p> });
interface PackageBuilderProps {
  cms?: CmsSection; regions: Region[]; packages: TravelPackage[]; initialMode?: Mode;
  initialRegionId?: string; initialSpotId?: string; showTransfer?: boolean; compact?: boolean;
  selectedVehicle?: { id: number; name: string; typeSlug: string; typeTitle: string; pricePerDay?: number };
  vehicleRates?: VehicleRateHint[];
}
type Mode = "packages" | "custom" | "transfer";

const TABS: { id: Mode; label: string; icon: "map-pin" | "location" | "car" }[] = [
  { id: "packages", label: "Choose Package", icon: "map-pin" },
  { id: "custom", label: "Create Package", icon: "location" },
  { id: "transfer", label: "Point to Point", icon: "car" },
];
function TabSwitcher({ active, onChange, showTransfer, tabId }: { active: Mode; onChange: (mode: Mode) => void; showTransfer: boolean; tabId: string }) {
  const tabs = TABS.filter(tab => showTransfer || tab.id !== "transfer");
  return <div role="tablist" aria-label="Choose your trip" className={`mx-auto mb-8 grid w-full max-w-2xl ${showTransfer ? "grid-cols-3" : "grid-cols-2"} gap-1 rounded-2xl border border-line bg-surface-muted p-1.5`}>
    {tabs.map((tab, index) => <button data-ui-action="" key={tab.id} id={`${tabId}-${tab.id}`} type="button" role="tab" aria-selected={active === tab.id} aria-controls={`${tabId}-panel`} tabIndex={active === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={event => {
      const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); onChange(tabs[next].id); (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus(); }
    }} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-3 text-center text-xs font-semibold transition-colors sm:flex-row sm:gap-2 sm:px-4 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${active === tab.id ? "bg-primary-900 text-white shadow-sm" : "text-muted hover:bg-surface-hover hover:text-fg"}`}><Icon name={tab.icon} className="h-4 w-4 shrink-0"/><span>{tab.label}</span></button>)}
  </div>;
}

// ─── Curated packages grid ────────────────────────────────────────────────────

function ChoosePackage({
  packages,
  onBuildOwn,
  vehicleId,
}: {
  packages: TravelPackage[];
  onBuildOwn: () => void;
  vehicleId?: number;
}) {
  return (
    <div>
      {packages.length === 0 && <div className="rounded-2xl border border-line bg-surface p-6 text-center"><h3 className="text-lg font-semibold text-fg">No ready-made packages published{vehicleId ? " for this vehicle" : ""} yet</h3><p className="mt-2 text-sm text-muted">Build your own route and send a booking request, or explore another region.</p><Button onClick={onBuildOwn} variant="accent" className="mt-4">Create your package</Button></div>}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg, i) => (
          <AnimateInView key={pkg.id} delay={i * 0.08}>
            <PackageCard pkg={pkg} vehicleId={vehicleId} />
          </AnimateInView>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-faint">
        Can&apos;t find what you&apos;re looking for?{" "}
        <button data-ui-action=""
          type="button"
          onClick={onBuildOwn}
          className="font-semibold text-primary-700 underline underline-offset-2 hover:text-accent-600 transition-colors"
        >
          Build your own package →
        </button>
      </p>
    </div>
  );
}

function RegionPicker({
  regions,
  selected,
  onSelect,
}: {
  regions: Region[];
  selected: Region | null;
  onSelect: (r: Region) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = regions.filter(region => `${region.name} ${region.state} ${region.spots.map(spot => `${spot.name} ${spot.cityName || ""}`).join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return (
    <div>
      <p className="mb-6 text-center text-muted">
        Select the region you want to explore
      </p>
      <label className="mx-auto mb-6 block max-w-xl text-sm font-semibold text-fg">Find a region, city or destination<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Start typing a place…" className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-normal text-fg" /></label>
      {!shown.length && <p role="status" className="mb-5 text-center text-sm text-muted">No published destinations match this search. Try another city or region.</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {shown.map((region) => (
          <motion.button
            key={region.id}
            type="button"
            whileHover={{ scale: selected?.id === region.id ? 1.06 : 1.04 }}
            whileTap={{ scale: 0.96 }}
            aria-label={`Explore ${region.name}`}
            onClick={() => onSelect(region)}
            className={`group relative overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
              selected?.id === region.id
                ? "ring-2 ring-accent-500 ring-offset-2 shadow-card-hover"
                : "shadow-card hover:shadow-card-hover"
            }`}
          >
            <div className="relative h-32 w-full sm:h-40">
              <DestinationPhoto
                imageUrl={region.imageUrl}
                alt={region.name}
                sizes="(max-width: 640px) 50vw, 20vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
              />
              <div
                className={`absolute inset-0 transition-all duration-300 ${
                  selected?.id === region.id
                    ? "bg-primary-900/55"
                    : "bg-gradient-to-t from-primary-900/70 via-primary-900/20 to-transparent"
                }`}
              />
              {/* Selection check */}
              <AnimatePresence>
                {selected?.id === region.id && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-white"
                  >
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
              <p className="font-display text-sm font-bold text-white">
                {region.name}
              </p>
              <p className="line-clamp-2 text-xs text-white/70" title={region.state}>{region.state}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}


export default function PackageBuilder({ regions, packages, cms, initialMode = "packages", initialRegionId, initialSpotId, selectedVehicle, vehicleRates, showTransfer = false, compact = false }: PackageBuilderProps) {
  const tabId = useId();
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [transferVisited, setTransferVisited] = useState(initialMode === "transfer");
  const [region, setRegion] = useState<Region | null>(() => regions.find(item => item.id === initialRegionId) ?? null);
  const [spotId, setSpotId] = useState(initialSpotId);
  return <Section id="build-package" bg="white" className={compact ? "!pb-8 !pt-2" : undefined} eyebrow={compact ? undefined : "Travel Packages"} title={compact ? undefined : "Plan Your Perfect Trip"} subtitle={compact ? undefined : "Choose a ready-made getaway or build a trip, one destination at a time."} {...cmsHeading(cms)}>
    <fieldset disabled={!interactive} aria-busy={!interactive} className="min-w-0">
      <TabSwitcher active={mode} onChange={next => { setMode(next); if (next === "transfer") setTransferVisited(true); }} showTransfer={showTransfer} tabId={tabId} />
      <div id={tabId + "-panel"} role="tabpanel" aria-labelledby={tabId + "-" + mode} tabIndex={0} className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
        {mode === "packages" && <ChoosePackage packages={packages} vehicleId={selectedVehicle?.id} onBuildOwn={() => setMode("custom")} />}
        {mode === "custom" && <div className="space-y-6">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Create your package</p><h2 className="mt-2 text-xl font-bold text-fg">{region ? "Choose your journey" : "Where would you like to go?"}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Pick a region and choose your next stops. Send your route with your email and phone number; our team will discuss your booking and price. Hotels are arranged by you.</p></div>
          {region ? <><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-4"><div><p className="font-semibold text-fg">{region.name}</p><p className="mt-1 line-clamp-2 text-xs text-muted">{region.state}</p></div><Button variant="outline" onClick={() => { setRegion(null); setSpotId(undefined); }}>Change region</Button></div><CustomerRoutePlanner key={region.id + ":" + (spotId ?? "")} region={region} initialSpotId={spotId} vehicleId={selectedVehicle?.id} vehicleRates={vehicleRates} onClearPlace={() => setSpotId(undefined)} /></> : <RegionPicker regions={regions} selected={null} onSelect={next => { setRegion(next); setSpotId(undefined); }} />}
        </div>}
        {showTransfer && transferVisited && <div hidden={mode !== "transfer"} className="space-y-6"><p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted">Just need a pickup and drop? Select the two locations below. Road distance and fare update automatically; any configured empty-return charge is itemised before you book.</p><Suspense fallback={<p role="status" className="text-center text-sm text-muted">Loading transfer booking…</p>}><BookingFlow enabled={mode === "transfer"} /></Suspense></div>}
      </div>
    </fieldset>
  </Section>;
}
