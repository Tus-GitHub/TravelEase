"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import Badge from "@/components/common/Badge";
import AnimateInView from "@/components/common/AnimateInView";
import PackageCard from "@/components/cards/PackageCard";
import MapSpotSelector from "@/components/ui/MapSpotSelector";
import { regions } from "@/data/regions";
import { travelPackages } from "@/data/packages";
import type { Region, TouristSpot } from "@/types";

// ─── Tab modes ────────────────────────────────────────────────────────────────

type Mode = "packages" | "custom";

const TABS: { id: Mode; label: string; icon: string }[] = [
  { id: "packages", label: "Choose a Package", icon: "✨" },
  { id: "custom",   label: "Build Your Own",   icon: "🗺️" },
];

function TabSwitcher({
  active,
  onChange,
}: {
  active: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="flex justify-center mb-12">
      <div className="relative flex rounded-2xl bg-surface-hover p-1.5 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative z-10 flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
              active === tab.id
                ? "text-white"
                : "text-muted hover:text-fg"
            }`}
          >
            {/* Sliding background */}
            {active === tab.id && (
              <motion.span
                layoutId="tab-bg"
                className="absolute inset-0 rounded-xl bg-primary-900 shadow-md"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.icon}</span>
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Curated packages grid ────────────────────────────────────────────────────

function ChoosePackage({ onBuildOwn }: { onBuildOwn: () => void }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {travelPackages.map((pkg, i) => (
          <AnimateInView key={pkg.id} delay={i * 0.08}>
            <PackageCard pkg={pkg} />
          </AnimateInView>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-faint">
        Can&apos;t find what you&apos;re looking for?{" "}
        <button
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
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, i) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <motion.div
              animate={
                current === step.num
                  ? { scale: 1.15, backgroundColor: "#f59e0b" }
                  : current > step.num
                  ? { scale: 1, backgroundColor: "#1d4ed8" }
                  : { scale: 1, backgroundColor: "#f1f5f9" }
              }
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-sm"
              style={{ color: current >= step.num ? "white" : "#94a3b8" }}
            >
              {current > step.num ? (
                <Icon name="check" className="h-4 w-4" />
              ) : (
                step.num
              )}
            </motion.div>
            <span
              className={`hidden text-xs font-medium sm:block transition-colors duration-200 ${
                current === step.num
                  ? "text-accent-600"
                  : current > step.num
                  ? "text-primary-700"
                  : "text-faint"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <motion.div
              className="mx-2 mb-4 h-0.5 w-12 sm:w-20"
              animate={{
                backgroundColor:
                  current > step.num ? "#1d4ed8" : "#e2e8f0",
              }}
              transition={{ duration: 0.4 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Region picker ────────────────────────────────────────────────────

function RegionPicker({
  selected,
  onSelect,
}: {
  selected: Region | null;
  onSelect: (r: Region) => void;
}) {
  return (
    <div>
      <p className="mb-6 text-center text-muted">
        Select the region you want to explore
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {regions.map((region, i) => (
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
              <p className="text-xs text-white/70">{region.state}</p>
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
                  <button
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
                  <button
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

const vehicleOptions = [
  { value: "tempo-traveller", label: "Tempo Traveller" },
  { value: "luxury-cars",     label: "Luxury Car" },
  { value: "family-cars",     label: "Family Car" },
  { value: "group-travel",    label: "Group Coach" },
];

const CONFETTI_COLORS = [
  "#f59e0b", "#3b82f6", "#10b981", "#f43f5e",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

function PackageSummary({
  region,
  spots,
  onReset,
}: {
  region: Region;
  spots: TouristSpot[];
  onReset: () => void;
}) {
  const [vehicle, setVehicle] = useState(vehicleOptions[0].value);

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
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {vehicleOptions.map((opt) => (
                  <motion.button
                    key={opt.value}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setVehicle(opt.value)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      vehicle === opt.value
                        ? "border-accent-500 bg-accent-50 text-accent-700 shadow-sm"
                        : "border-line text-muted hover:border-primary-300 hover:bg-primary-50"
                    }`}
                  >
                    {opt.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="accent"
                size="lg"
                fullWidth
                iconRight="arrow-right"
              >
                Book This Package
              </Button>
              <Button variant="outline" size="lg" onClick={onReset}>
                Start Over
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-faint">
              Pricing shown after selecting travel dates in the next step
            </p>
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

export default function PackageBuilder() {
  const [mode, setMode]               = useState<Mode>("packages");
  const [step, setStep]               = useState(1);
  const [region, setRegion]           = useState<Region | null>(null);
  const [selectedSpots, setSelectedSpots] = useState<TouristSpot[]>([]);
  const [orderedSpots, setOrderedSpots]   = useState<TouristSpot[]>([]);

  const handleRegionSelect = (r: Region) => {
    setRegion(r);
    setSelectedSpots([]);
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
      eyebrow="Travel Packages"
      title="Plan Your Perfect Trip"
      subtitle="Pick from our curated packages or build your very own — your trip, your way."
    >
      {/* Tab switcher */}
      <TabSwitcher active={mode} onChange={(m) => { setMode(m); if (m === "custom") reset(); }} />

      {/* Mode panels */}
      <AnimatePresence mode="wait" initial={false}>
        {mode === "packages" ? (
          <motion.div
            key="packages-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <ChoosePackage onBuildOwn={() => setMode("custom")} />
          </motion.div>
        ) : (
          <motion.div
            key="custom-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
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
                  <RegionPicker selected={region} onSelect={handleRegionSelect} />
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
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}
