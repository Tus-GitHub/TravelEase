"use client";

import { Suspense, useEffect, useId, useState } from "react";
import Image from "next/image";
import Select from "@/components/controls/Select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import Badge from "@/components/common/Badge";
import AnimateInView from "@/components/common/AnimateInView";
import PackageCard from "@/components/cards/PackageCard";
import RouteOptimizer from "@/components/packages/RouteOptimizer";
import ItineraryIdeas from "@/components/packages/ItineraryIdeas";
import MapSpotSelector from "@/components/ui/MapSpotSelector";
import dynamic from "next/dynamic";
const BookingFlow = dynamic(() => import("@/components/booking/BookingFlow"), { loading: () => <p role="status" className="text-center text-sm text-muted">Loading transfer booking…</p> });
import { useAuth } from "@/context/AuthContext";
import type { Region, TouristSpot, TravelPackage } from "@/types";
import { cmsHeading, type CmsSection } from "@/lib/cms";

type SaveState = "idle" | "saving" | "saved" | "error";

interface PackageBuilderProps {
  cms?: CmsSection;
  regions: Region[];
  packages: TravelPackage[];
  initialMode?: Mode;
  initialRegionId?: string;
  initialSpotId?: string;
  showTransfer?: boolean;
  compact?: boolean;
  selectedVehicle?: { id: number; name: string; typeSlug: string; typeTitle: string; pricePerDay?: number };
}

// ─── Tab modes ────────────────────────────────────────────────────────────────

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
      {packages.length === 0 && <div className="rounded-2xl border border-line bg-surface p-6 text-center"><h3 className="text-lg font-semibold text-fg">No ready-made packages published{vehicleId ? " for this vehicle" : ""} yet</h3><p className="mt-2 text-sm text-muted">Create your own route from available destinations. Review what is included before booking.</p><Button onClick={onBuildOwn} variant="accent" className="mt-4">Create your package</Button></div>}
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

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Pick Region" },
  { num: 2, label: "Choose Spots" },
  { num: 3, label: "Set Route" },
  { num: 4, label: "Your Package" },
];

function StepIndicator({ current }: { current: number }) {
  return <ol aria-label="Package planning progress" className="mx-auto mb-8 grid max-w-2xl grid-cols-4 gap-2">{STEPS.map(step => <li key={step.num} aria-current={current === step.num ? "step" : undefined} className="flex min-w-0 flex-col items-center gap-2 text-center"><span className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${current >= step.num ? "border-primary-900 bg-primary-900 text-white" : "border-line bg-surface text-muted"}`}>{current > step.num ? <Icon name="check" className="h-4 w-4"/> : step.num}</span><span className={`text-xs leading-relaxed ${current === step.num ? "font-semibold text-fg" : "text-muted"}`}>{step.label}</span></li>)}</ol>;
}

// ─── Step 1: Region picker ────────────────────────────────────────────────────

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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {shown.map((region, i) => (
          <motion.button
            key={region.id}
            type="button"
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.07, ease: "easeOut" }}
            whileHover={{ scale: selected?.id === region.id ? 1.06 : 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelect(region)}
            className={`group relative overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
              selected?.id === region.id
                ? "ring-2 ring-accent-500 ring-offset-2 shadow-card-hover"
                : "shadow-card hover:shadow-card-hover"
            }`}
          >
            <div className="relative h-32 w-full sm:h-36">
              <Image
                src={region.imageUrl}
                alt={region.name}
                fill
                sizes="(max-width: 640px) 50vw, 20vw"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
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

// ─── Step 2: Spot selector ────────────────────────────────────────────────────

const MIN_SPOTS = 2;
const MAX_SPOTS = 5;


// ─── Step 3: Route builder ────────────────────────────────────────────────────

function RouteBuilder({
  spots,
  onChange,
}: {
  spots: TouristSpot[];
  onChange: (spots: TouristSpot[]) => void;
}) {
  const move = (index: number, dir: -1 | 1) => {
    const next = [...spots];
    const target = index + dir;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="mx-auto max-w-xl">
      <p className="mb-6 text-center text-muted">
        Use the arrows to set your preferred travel order
      </p>

      <RouteOptimizer key={spots.map(s => s.id).join(",")} spots={spots} onApply={onChange} />

      <motion.ol className="space-y-3" layout>
        <AnimatePresence>
          {spots.map((spot, i) => (
            <motion.li
              key={spot.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="flex items-center gap-4"
            >
              {/* Stop number */}
              <motion.span
                key={`num-${i}`}
                animate={{ scale: [1.2, 1] }}
                transition={{ duration: 0.2 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-900 font-bold text-white text-sm"
              >
                {i + 1}
              </motion.span>

              {/* Card */}
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-line-subtle bg-surface p-3 shadow-card">
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={spot.imageUrl}
                    alt={spot.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-fg truncate">
                    {spot.name}
                  </p>
                  <Badge tone="primary" className="mt-1">
                    {spot.tag}
                  </Badge>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button data-ui-action=""
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-primary-50 hover:text-primary-800 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button data-ui-action=""
                    type="button"
                    disabled={i === spots.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-primary-50 hover:text-primary-800 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ol>

      {/* Route preview strip */}
      <motion.div
        layout
        className="mt-8 flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface-muted px-6 py-4 text-sm"
      >
        {spots.map((spot, i) => (
          <span key={spot.id} className="flex items-center gap-2">
            <span className="font-semibold text-primary-900 dark:text-primary-300 ">{spot.name}</span>
            {i < spots.length - 1 && (
              <Icon name="arrow-right" className="h-4 w-4 text-accent-500" />
            )}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Step 4: Package summary ──────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#f59e0b", "#3b82f6", "#10b981", "#f43f5e",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

function PackageSummary({
  region,
  spots,
  onReset,
  onBook,
  onSave,
  saveState,
  canSave,
  selectedVehicle,
}: {
  region: Region;
  spots: TouristSpot[];
  onReset: () => void;
  onBook: (vehicleSlug: string, vehicleId: number) => void;
  onSave: (vehicleSlug: string) => void;
  saveState: SaveState;
  canSave: boolean;
  selectedVehicle?: PackageBuilderProps["selectedVehicle"];
}) {
  const [vehicles, setVehicles] = useState<NonNullable<PackageBuilderProps["selectedVehicle"]>[]>([]);
  const [vehicleId, setVehicleId] = useState(selectedVehicle ? String(selectedVehicle.id) : "");
  const [vehicleError, setVehicleError] = useState(""), [vehicleLoading, setVehicleLoading] = useState(!selectedVehicle);
  useEffect(() => {
    if (selectedVehicle) return;
    const controller = new AbortController();
    fetch("/api/vehicles?available=1", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Could not load vehicles. Return to the vehicle list and choose your car.");
      const data = await response.json(); if (controller.signal.aborted) return;
      const available = Array.isArray(data.vehicles) ? data.vehicles : [];
      setVehicles(available); if (available.length === 1) setVehicleId(String(available[0].id));
      if (!available.length) setVehicleError("No vehicles are available to book right now. Your route remains here.");
    }).catch(error => { if (!controller.signal.aborted) setVehicleError(error.message); }).finally(() => { if (!controller.signal.aborted) setVehicleLoading(false); });
    return () => controller.abort();
  }, [selectedVehicle]);
  const vehicle = selectedVehicle || vehicles.find(item => String(item.id) === vehicleId);


  return (
    <div className="mx-auto max-w-2xl relative">
      {/* Confetti burst */}
      <div className="pointer-events-none absolute inset-x-0 -top-4 flex justify-center overflow-hidden">
        {CONFETTI_COLORS.map((color, i) => (
          <div
            key={i}
            className={`confetti-${i + 1} mx-1 h-3 w-3 rounded-sm`}
            style={{
              backgroundColor: color,
              transform: `rotate(${i * 45}deg) translateX(${(i - 4) * 12}px)`,
            }}
          />
        ))}
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98] }}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <Badge tone="accent" className="text-sm px-4 py-1.5">
            Your Custom Package
          </Badge>
          <h3 className="mt-3 font-display text-2xl font-bold text-fg">
            {region.name} Explorer
          </h3>
          <p className="mt-1 text-muted">
            {spots.length} destinations · Self-curated
          </p>
        </div>

        {/* Route card */}
        <div className="overflow-hidden rounded-2xl border border-line-subtle bg-surface shadow-card">
          {/* Region banner */}
          <div className="relative h-32">
            <Image
              src={region.imageUrl}
              alt={region.name}
              fill
              sizes="672px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary-900/80 to-primary-700/50" />
            <div className="absolute inset-0 flex items-center px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-300">
                  Region
                </p>
                <p className="font-display text-2xl font-bold text-white">
                  {region.name}
                </p>
              </div>
            </div>
          </div>

          {/* Itinerary */}
          <div className="p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-faint">
              Your Itinerary
            </p>
            <ol className="space-y-3">
              {spots.map((spot, i) => (
                <motion.li
                  key={spot.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="flex items-center gap-4"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-900 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="flex flex-1 items-center justify-between">
                    <span className="font-semibold text-fg">
                      {spot.name}
                    </span>
                    <Badge tone="neutral">{spot.tag}</Badge>
                  </div>
                </motion.li>
              ))}
            </ol>

            {/* Vehicle selector */}
            <div className="mt-6 border-t border-line-subtle pt-5">
              <label className="block text-sm font-semibold text-fg">
                Choose Vehicle
              </label>
              {selectedVehicle ? <p className="mt-3 rounded-xl border border-line bg-surface-muted p-4 text-sm font-semibold text-fg">{selectedVehicle.name}</p> : <Select aria-label="Trip vehicle" searchable value={vehicleId} disabled={vehicleLoading} onChange={event => setVehicleId(event.target.value)} className="mt-3 w-full rounded-xl border border-line bg-surface px-3 py-3 text-base text-fg"><option value="">{vehicleLoading ? "Loading available vehicles…" : "Choose your trip vehicle"}</option>{vehicles.map(item => <option key={item.id} value={item.id}>{item.name} · {item.typeTitle}</option>)}</Select>}
              {vehicleError && <p role="status" className="mt-2 text-sm text-muted">{vehicleError}</p>}
              {vehicle?.pricePerDay != null && <p className="mt-3 text-sm text-muted">Vehicle hire from ₹{vehicle.pricePerDay.toLocaleString("en-IN")}/day. Your dates and any configured trip rates determine the final quote.</p>}
              <p className="mt-2 text-xs leading-relaxed text-muted">Your itinerary reserves vehicle transport. Stays, meals, guide arrangements and extras are included only when listed in a published package.</p>
            </div>

            {/* CTAs */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="accent"
                size="lg"
                fullWidth
                iconRight="arrow-right"
                disabled={!vehicle || vehicleLoading}
                onClick={() => { if (vehicle) onBook(vehicle.typeSlug, vehicle.id); }}
              >
                Book This Package
              </Button>
              <Button variant="outline" size="lg" onClick={onReset}>
                Start Over
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
              {saveState === "saved" ? (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  Saved —{" "}
                  <Link href="/profile/saved" className="hover-underline">
                    view saved trips
                  </Link>
                </span>
              ) : (
                <button data-ui-action=""
                  type="button"
                  onClick={() => { if (vehicle) onSave(vehicle.typeSlug); }}
                  disabled={saveState === "saving" || !vehicle || vehicleLoading}
                  className="inline-flex items-center gap-1.5 font-medium text-primary-700 underline underline-offset-2 transition-colors hover:text-accent-600 disabled:opacity-60 dark:text-primary-300"
                >
                  <Icon name="bookmark" className="h-4 w-4" />
                  {saveState === "saving"
                    ? "Saving…"
                    : canSave
                      ? "Save for later"
                      : "Sign in to save for later"}
                </button>
              )}
              {saveState === "error" && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  Couldn&apos;t save. Try again.
                </span>
              )}
            </div>

            <p className="mt-4 text-center text-xs text-faint">
              Choose your travel dates and see the full price on the next step.
            </p>
            <div className="mt-5 rounded-2xl border border-line bg-surface-muted p-4 text-center">
              <p className="mb-3 text-sm text-muted">Planning an overnight stay? Explore hotel options separately.</p>
              <Button href={`/hotels?region=${region.id}`} variant="outline" size="sm" iconLeft="map-pin">Explore hotels</Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Step motion config ───────────────────────────────────────────────────────

const stepVariants = {
  enter:  { opacity: 0, x: 28 },
  center: { opacity: 1, x: 0 },
  exit:   { opacity: 0, x: -28 },
};

// ─── Main PackageBuilder section ──────────────────────────────────────────────

export default function PackageBuilder({ regions, packages, cms, initialMode = "packages", initialRegionId, initialSpotId, selectedVehicle, showTransfer = false, compact = false }: PackageBuilderProps) {
  const router = useRouter();
  const tabId = useId();
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  const { user } = useAuth();
  const [transferVisited, setTransferVisited] = useState(initialMode === "transfer");
  const [mode, setMode]               = useState<Mode>(initialMode);
  const initialRegion = regions.find(item=>item.id===initialRegionId);
  const [step, setStep]               = useState(initialRegion ? 2 : 1);
  const [region, setRegion]           = useState<Region | null>(initialRegion ?? null);
  const [selectedSpots, setSelectedSpots] = useState<TouristSpot[]>(()=>initialRegion?.spots.filter(spot=>spot.id===initialSpotId) ?? []);
  const [orderedSpots, setOrderedSpots]   = useState<TouristSpot[]>([]);
  const [saveState, setSaveState]     = useState<SaveState>("idle");

  // Any change to the route invalidates a prior "Saved" confirmation.
  useEffect(() => setSaveState("idle"), [orderedSpots]);

  // Build Your Own -> the booking flow. Spot ids are the real tourist_spot_ids
  // (as strings); /booking/new parses them back and snapshots them as stops.
  const bookCustomPackage = (vehicleSlug: string, chosenVehicleId: number) => {
    if (!region || orderedSpots.length === 0) return;
    const params = new URLSearchParams({
      type: "package",
      spots: orderedSpots.map((s) => s.id).join(","),
      vehicleType: vehicleSlug,
      regionName: region.name,
    });
    params.set("vehicle", String(selectedVehicle?.id ?? chosenVehicleId));
    router.push(`/booking/new?${params.toString()}`);
  };

  // Build Your Own -> save the route for later (Phase 3, saved itineraries).
  const saveCustomPackage = async (vehicleSlug: string) => {
    if (!region || orderedSpots.length < 2) return;
    if (!user) {
      router.push("/login?redirect=/");
      return;
    }
    setSaveState("saving");
    try {
      const res = await fetch("/api/saved-itineraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "custom",
          regionId: Number(region.id),
          vehicleTypeSlug: vehicleSlug,
          spotIds: orderedSpots.map((s) => Number(s.id)),
          title: `${region.name} itinerary`,
        }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  };

  const handleRegionSelect = (r: Region) => {
    setRegion(r);
    setSelectedSpots([]);
    setStep(2);
  };

  const toggleSpot = (spot: TouristSpot) => {
    setSelectedSpots((prev) =>
      prev.some((s) => s.id === spot.id)
        ? prev.filter((s) => s.id !== spot.id)
        : prev.length < MAX_SPOTS
        ? [...prev, spot]
        : prev,
    );
  };

  const handleGoToRoute = () => {
    setOrderedSpots([...selectedSpots]);
    setStep(3);
  };

  const reset = () => {
    setStep(1);
    setRegion(null);
    setSelectedSpots([]);
    setOrderedSpots([]);
  };

  return (
    <Section
      id="build-package"
      bg="white"
      className={compact ? "!pb-8 !pt-2" : undefined}
      eyebrow={compact ? undefined : "Travel Packages"}
      title={compact ? undefined : "Plan Your Perfect Trip"}
      subtitle={compact ? undefined : "Pick from our curated packages or build your very own — your trip, your way."}
      {...cmsHeading(cms)}
    >
      <fieldset disabled={!interactive} aria-busy={!interactive} className="min-w-0">
      {/* Tab switcher */}
      <TabSwitcher active={mode} onChange={next => { setMode(next); if (next === "transfer") setTransferVisited(true); }} showTransfer={showTransfer} tabId={tabId} />
      <div id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${mode}`} tabIndex={0} className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">

      {/* Mode panels */}
      <AnimatePresence mode="wait" initial={false}>
        {mode !== "transfer" && (mode === "packages" ? (
          <motion.div
            key="packages-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <ChoosePackage
              packages={packages}
              onBuildOwn={() => setMode("custom")}
              vehicleId={selectedVehicle?.id}
            />
          </motion.div>
        ) : (
          <motion.div
            key="custom-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {packages.some(pkg=>pkg.isGuided&&pkg.isBookable!==false)&&<div className="mb-8 space-y-4"><h3 className="text-xl font-semibold text-fg">Choose a route to customise</h3><p className="text-sm text-muted">Start with a trip our team can arrange, then choose the next destinations and see how the price changes.</p><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{packages.filter(pkg=>pkg.isGuided&&pkg.isBookable!==false).map(pkg=><PackageCard key={pkg.id} pkg={pkg} vehicleId={selectedVehicle?.id}/>)}</div></div>}
            <div className="space-y-6">
            <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm leading-relaxed text-muted"><h3 className="font-semibold text-fg">Build your own itinerary</h3><p className="mt-2">Choose a region, add destinations and set your route. You can save your plan or continue straight to booking. Hotels, meals and a guide are included only when listed in a chosen package.</p></div>
            <StepIndicator current={step} />

            {/* Animated step container */}
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 && (
                <motion.div
                  key="step-1"
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <RegionPicker
                    regions={regions}
                    selected={region}
                    onSelect={handleRegionSelect}
                  />
                  <div className="mt-10 flex justify-center">
                    <Button
                      variant="primary"
                      size="lg"
                      iconRight="arrow-right"
                      disabled={!region}
                      onClick={() => setStep(2)}
                    >
                      Continue to Spots
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 2 && region && (
                <motion.div
                  key="step-2"
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <ItineraryIdeas
                    key={`${region.id}:${user?.id ?? "guest"}:${selectedSpots.map(spot => spot.id).join(",")}`}
                    region={region}
                    selected={selectedSpots}
                    onApply={(spots) => { setSelectedSpots(spots); setOrderedSpots(spots); setStep(3); }}
                  />
                  <MapSpotSelector
                    region={region}
                    selected={selectedSpots}
                    onToggle={toggleSpot}
                    maxSpots={MAX_SPOTS}
                  />
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      iconRight="arrow-right"
                      disabled={selectedSpots.length < MIN_SPOTS}
                      onClick={handleGoToRoute}
                    >
                      Set Route
                      {selectedSpots.length >= MIN_SPOTS && (
                        <motion.span
                          key={selectedSpots.length}
                          initial={{ scale: 1.3 }}
                          animate={{ scale: 1 }}
                          className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs"
                        >
                          {selectedSpots.length} spots
                        </motion.span>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step-3"
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <RouteBuilder spots={orderedSpots} onChange={setOrderedSpots} />
                  <div className="mt-10 flex items-center justify-center gap-4">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      iconRight="arrow-right"
                      onClick={() => setStep(4)}
                    >
                      Build My Package
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 4 && region && (
                <motion.div
                  key="step-4"
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <PackageSummary
                    region={region}
                    spots={orderedSpots}
                    onReset={reset}
                    onBook={bookCustomPackage}
                    onSave={saveCustomPackage}
                    saveState={saveState}
                    canSave={!!user}
                    selectedVehicle={selectedVehicle}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {showTransfer && transferVisited && <div hidden={mode !== "transfer"} className="space-y-6"><p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted">Just need a pickup and drop? Select the two locations below. Road distance and fare update automatically; any configured empty-return charge is itemised before you book.</p><Suspense fallback={<p role="status" className="text-center text-sm text-muted">Loading transfer booking…</p>}><BookingFlow enabled={mode === "transfer"} /></Suspense></div>}
      </div>
      </fieldset>
    </Section>
  );
}
