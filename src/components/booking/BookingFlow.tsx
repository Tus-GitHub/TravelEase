"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { useAuth } from "@/context/AuthContext";
import type { BookingTypeCode } from "@/lib/server/pricing";

type Mode = "curated" | "custom" | "vehicle" | "generic";

const BOOKING_TYPES: { code: BookingTypeCode; label: string }[] = [
  { code: "point_to_point", label: "Point to point" },
  { code: "hourly", label: "Hourly rental" },
  { code: "outstation", label: "Outstation (round trip)" },
  { code: "airport_transfer", label: "Airport transfer" },
  { code: "package", label: "Multi-day package" },
];

interface QuoteLine {
  label: string;
  amount: number;
}
interface Quote {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  breakdown: QuoteLine[];
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fieldCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none transition-[border-color,box-shadow] focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/60";

export default function BookingFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const packageSlug = params.get("package");
  const vehicleId = params.get("vehicle");
  const spotsParam = params.get("spots");
  const typeParam = params.get("type") as BookingTypeCode | null;
  const vehicleTypeSlugParam = params.get("vehicleType");

  const mode: Mode = packageSlug
    ? "curated"
    : typeParam === "package" && spotsParam
      ? "custom"
      : vehicleId
        ? "vehicle"
        : "generic";

  // ---- form state (seeded from the URL so a login round-trip loses nothing, §34) ----
  const [bookingType, setBookingType] = useState<BookingTypeCode>(
    mode === "curated" || mode === "custom"
      ? "package"
      : (typeParam ?? "point_to_point"),
  );
  const [startDate, setStart] = useState(params.get("start") ?? "");
  const [passengers, setPassengers] = useState(Number(params.get("pax")) || 2);
  const [pickupAddress, setPickup] = useState(params.get("pickup") ?? "");
  const [dropAddress, setDrop] = useState(params.get("drop") ?? "");
  const [distanceKm, setDistance] = useState(Number(params.get("km")) || 0);
  const [hours, setHours] = useState(Number(params.get("hrs")) || 0);
  const [days, setDays] = useState(
    Number(params.get("days")) || (spotsParam ? spotsParam.split(",").length : 0),
  );
  const [nights, setNights] = useState(Number(params.get("nights")) || 0);
  const [notes, setNotes] = useState(params.get("notes") ?? "");

  const [meta, setMeta] = useState<{
    title: string;
    subtitle: string;
    pricePerPerson?: number;
  } | null>(null);
  const [vehicleTypeId, setVehicleTypeId] = useState<number | null>(null);
  const [stopIds, setStopIds] = useState<number[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // ---- load supporting data ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (mode === "curated" && packageSlug) {
          const res = await fetch(`/api/packages/${encodeURIComponent(packageSlug)}`);
          if (!res.ok) throw new Error("Package not found.");
          const { package: pkg } = await res.json();
          if (cancelled) return;
          setMeta({
            title: pkg.name,
            subtitle: `${pkg.regionName} · ${pkg.durationDays} days · ${pkg.destinations.join(" → ")}`,
            pricePerPerson: pkg.pricePerPerson,
          });
          setDays(pkg.durationDays);
        } else if (mode === "custom" && spotsParam) {
          const ids = spotsParam
            .split(",")
            .map((s) => Number(s))
            .filter(Number.isInteger);
          setStopIds(ids);
          const [regRes, vtRes] = await Promise.all([
            fetch("/api/regions"),
            fetch("/api/vehicle-types"),
          ]);
          const { regions } = await regRes.json();
          const { vehicleTypes } = await vtRes.json();
          if (cancelled) return;
          const allSpots = new Map<number, string>();
          for (const r of regions) for (const s of r.spots) allSpots.set(s.id, s.name);
          const names = ids.map((id) => allSpots.get(id)).filter(Boolean);
          const vt = vehicleTypes.find(
            (t: { slug: string }) => t.slug === vehicleTypeSlugParam,
          );
          setVehicleTypeId(vt?.id ?? null);
          setMeta({
            title: `Custom ${params.get("regionName") ?? "trip"} package`,
            subtitle: names.length ? names.join(" → ") : `${ids.length} stops`,
          });
          if (!days) setDays(ids.length);
        } else if (mode === "vehicle" && vehicleId) {
          const [vRes, vtRes] = await Promise.all([
            fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}`),
            fetch("/api/vehicle-types"),
          ]);
          if (!vRes.ok) throw new Error("Vehicle not found.");
          const { vehicle } = await vRes.json();
          const { vehicleTypes } = await vtRes.json();
          if (cancelled) return;
          const vt = vehicleTypes.find(
            (t: { slug: string }) => t.slug === vehicle.typeSlug,
          );
          setVehicleTypeId(vt?.id ?? null);
          setMeta({
            title: vehicle.name,
            subtitle: `${vehicle.typeTitle} · ${vehicle.seatingCapacity} seats · ${inr(vehicle.pricePerDay)}/day`,
          });
        } else {
          const vtRes = await fetch("/api/vehicle-types");
          const { vehicleTypes } = await vtRes.json();
          if (cancelled) return;
          setVehicleTypeId(vehicleTypes[0]?.id ?? null);
          setMeta({ title: "New booking", subtitle: "Tell us about your trip." });
        }
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "Failed to load.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, packageSlug, vehicleId, spotsParam]);

  // ---- live quote ----
  const quoteBody = useMemo(() => {
    const body: Record<string, unknown> = { bookingType, passengers };
    if (bookingType === "package") {
      if (packageSlug) body.packageSlug = packageSlug;
      body.days = days || undefined;
      body.nights = nights || undefined;
      if (vehicleTypeId) body.vehicleTypeId = vehicleTypeId;
    } else {
      if (vehicleTypeId) body.vehicleTypeId = vehicleTypeId;
      if (distanceKm) body.distanceKm = distanceKm;
      if (hours) body.hours = hours;
      if (days) body.days = days;
      if (nights) body.nights = nights;
    }
    return body;
  }, [bookingType, passengers, packageSlug, days, nights, vehicleTypeId, distanceKm, hours]);

  const quoteTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!meta) return;
    clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(async () => {
      setQuoting(true);
      try {
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quoteBody),
        });
        const data = await res.json();
        setQuote(res.ok ? data.quote : null);
      } catch {
        setQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 350);
    return () => clearTimeout(quoteTimer.current);
  }, [quoteBody, meta]);

  const currentUrlWithState = useCallback(() => {
    const p = new URLSearchParams(params.toString());
    p.set("start", startDate);
    p.set("pax", String(passengers));
    if (pickupAddress) p.set("pickup", pickupAddress);
    if (dropAddress) p.set("drop", dropAddress);
    if (distanceKm) p.set("km", String(distanceKm));
    if (hours) p.set("hrs", String(hours));
    if (days) p.set("days", String(days));
    if (nights) p.set("nights", String(nights));
    if (notes) p.set("notes", notes);
    if (mode === "generic" || mode === "vehicle") p.set("type", bookingType);
    return `/booking/new?${p.toString()}`;
  }, [
    params, startDate, passengers, pickupAddress, dropAddress, distanceKm, hours,
    days, nights, notes, mode, bookingType,
  ]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!startDate) {
      setError("Please choose a travel date and time.");
      return;
    }

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(currentUrlWithState())}`);
      return;
    }

    setSubmitting(true);
    const payload: Record<string, unknown> = {
      bookingType,
      startDateTime: new Date(startDate).toISOString(),
      passengerCount: passengers,
      pickupAddress: pickupAddress || undefined,
      dropAddress: dropAddress || undefined,
      customerNotes: notes || undefined,
    };
    if (bookingType === "package") {
      if (packageSlug) payload.packageSlug = packageSlug;
      if (stopIds.length) payload.stops = stopIds.map((id) => ({ touristSpotId: id }));
      if (vehicleTypeId) payload.vehicleTypeId = vehicleTypeId;
      if (days) payload.durationDays = days;
      if (nights) payload.nights = nights;
    } else {
      if (vehicleTypeId) payload.vehicleTypeId = vehicleTypeId;
      if (vehicleId) payload.vehicleId = Number(vehicleId);
      if (distanceKm) payload.estimatedDistanceKm = distanceKm;
      if (hours) payload.estimatedHours = hours;
      if (days) payload.durationDays = days;
      if (nights) payload.nights = nights;
    }

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitting(false);
        setError(data.error ?? "Couldn't create the booking.");
        return;
      }
      router.push(`/booking/${data.booking.id}/confirm`);
    } catch {
      setSubmitting(false);
      setError("Couldn't reach the server. Try again.");
    }
  };

  if (loadErr) {
    return (
      <Card padded hover={false} className="mx-auto max-w-lg text-center">
        <p className="text-sm text-muted">{loadErr}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button href="/packages" variant="outline" size="sm">
            Browse packages
          </Button>
          <Button href="/vehicles" variant="outline" size="sm">
            Browse vehicles
          </Button>
        </div>
      </Card>
    );
  }
  if (!meta) {
    return <p className="text-center text-sm text-muted">Loading…</p>;
  }

  const showDistance = bookingType === "point_to_point" || bookingType === "outstation" || bookingType === "airport_transfer";
  const showHours = bookingType === "hourly";
  const showDays = bookingType === "package" || bookingType === "outstation";
  const showDrop = bookingType === "point_to_point" || bookingType === "airport_transfer";

  return (
    <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[1.4fr_1fr]">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-faint">
            {mode === "curated" ? "Curated package" : mode === "custom" ? "Your package" : "Trip"}
          </p>
          <h2 className="mt-1 font-display text-xl font-bold text-fg">{meta.title}</h2>
          <p className="mt-1 text-sm text-muted">{meta.subtitle}</p>
        </div>

        {(mode === "vehicle" || mode === "generic") && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">Trip type</span>
            <select
              className={fieldCls}
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value as BookingTypeCode)}
            >
              {BOOKING_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">Start date &amp; time</span>
            <input
              type="datetime-local"
              className={fieldCls}
              value={startDate}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">Passengers</span>
            <input
              type="number"
              min={1}
              max={60}
              className={fieldCls}
              value={passengers}
              onChange={(e) => setPassengers(Math.max(1, Number(e.target.value)))}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">Pickup address</span>
          <input
            type="text"
            className={fieldCls}
            placeholder="Where should the chauffeur pick you up?"
            value={pickupAddress}
            onChange={(e) => setPickup(e.target.value)}
          />
        </label>

        {showDrop && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">Drop address</span>
            <input
              type="text"
              className={fieldCls}
              value={dropAddress}
              onChange={(e) => setDrop(e.target.value)}
            />
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {showDistance && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">Distance (km)</span>
              <input
                type="number"
                min={0}
                className={fieldCls}
                value={distanceKm || ""}
                onChange={(e) => setDistance(Number(e.target.value))}
              />
            </label>
          )}
          {showHours && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">Hours</span>
              <input
                type="number"
                min={0}
                className={fieldCls}
                value={hours || ""}
                onChange={(e) => setHours(Number(e.target.value))}
              />
            </label>
          )}
          {showDays && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">Days</span>
              <input
                type="number"
                min={1}
                className={fieldCls}
                value={days || ""}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </label>
          )}
          {showDays && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">Nights</span>
              <input
                type="number"
                min={0}
                className={fieldCls}
                value={nights || ""}
                onChange={(e) => setNights(Number(e.target.value))}
              />
            </label>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">Notes (optional)</span>
          <textarea
            rows={2}
            className={fieldCls}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl border border-red-400/30 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        <Button type="submit" variant="accent" size="lg" fullWidth loading={submitting}>
          {!isLoading && !user
            ? "Sign in to book"
            : submitting
              ? "Creating your booking…"
              : "Confirm booking"}
        </Button>
        <p className="text-center text-xs text-faint">
          Book now, pay offline. We&apos;ll confirm your trip by email.
        </p>
      </form>

      <aside>
        <Card padded hover={false} className="sticky top-24">
          <p className="text-xs font-semibold uppercase tracking-wider text-faint">Price estimate</p>
          {quote ? (
            <>
              <ul className="mt-3 space-y-1.5 text-sm">
                {quote.breakdown.map((l) => (
                  <li key={l.label} className="flex justify-between gap-4">
                    <span className="text-muted">{l.label}</span>
                    <span className="font-medium text-fg">{inr(l.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-line pt-3">
                <span className="font-semibold text-fg">Total</span>
                <span className="font-display text-lg font-bold text-primary-900 dark:text-primary-300">
                  {inr(quote.totalAmount)}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {quoting ? "Calculating…" : "Fill in the trip details for a price."}
            </p>
          )}
          <p className="mt-4 text-xs text-faint">
            The final price is confirmed by Jagdamba Travellers when your booking is reviewed.
          </p>
          <p className="mt-3 text-xs text-faint">
            <Link href="/policy/cancellation" className="hover-underline">
              Cancellation policy
            </Link>
          </p>
        </Card>
      </aside>
    </div>
  );
}
