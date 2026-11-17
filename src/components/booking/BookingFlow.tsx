"use client";
import Select from "@/components/controls/Select";


import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { useAuth } from "@/context/AuthContext";
import type { BookingTypeCode } from "@/lib/server/pricing";
import DateTimeSelector from "./DateTimeSelector";
import { bookingInstant, bookingTimeValue, validBookingTime as validDateTime } from "@/lib/booking-datetime";
import TripRouteSelector from "./TripRouteSelector";
import { routePoint, type BookingRoute, type RoutePoint } from "@/lib/booking-route";
import { isValidPhone, normalizePhone } from "@/lib/validation";
import { tripDuration } from "@/lib/booking-duration";
import { selectPackageRoute, type PackageContent, type SelectedRoute } from "@/lib/package-content";
import PackagePlanView from "@/components/packages/PackagePlanView";

type Mode = "curated" | "custom" | "vehicle" | "generic";

const BOOKING_TYPES: { code: BookingTypeCode; label: string }[] = [
  { code: "point_to_point", label: "One-way drop" },
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
  packageFingerprint?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  breakdown: QuoteLine[];
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fieldCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none transition-[border-color,box-shadow] focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/60";

export default function BookingFlow({ enabled = true }: { enabled?: boolean } = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [contactPhone, setContactPhone] = useState("");
  useEffect(() => {
    if (user?.phone && !/^0+$/.test(user.phone.trim())) {
      setContactPhone(previous => previous || user.phone);
    }
  }, [user?.phone]);

  const packageSlug = params.get("package");
  const guidedPathParam = params.get("path");
  const guidedPath = useMemo(() => guidedPathParam ? guidedPathParam.split(',').map(Number) : [], [guidedPathParam]);
  const [packageRefresh, setPackageRefresh] = useState(0);
  const [packagePreview, setPackagePreview] = useState<{ content: PackageContent; selectedRoute?: SelectedRoute } | null>(null);
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
  const [startDate,setStart]=useState(()=>{const raw=params.get("start")??"";if(validDateTime(raw))return raw;const date=new Date(raw);return Number.isFinite(date.getTime())?bookingTimeValue(date):"";});
  const [passengers, setPassengers] = useState(Number(params.get("pax")) || 2);
  const [capacity, setCapacity] = useState(60);
  const [endDate, setEnd] = useState(() => validDateTime(params.get("end") ?? "") ? params.get("end")! : "");
  let duration: { days: number; nights: number } | null = null;
  if (validDateTime(startDate) && validDateTime(endDate)) { try { duration = tripDuration(bookingInstant(startDate), bookingInstant(endDate)); } catch { /* validated on submission */ } }
  const [pickupAddress, setPickup] = useState(params.get("pickup") ?? "");
  const [dropAddress, setDrop] = useState(params.get("drop") ?? "");
  const [distanceKm, setDistance] = useState(Number(params.get("km")) || 0);
  const [pickupPoint, setPickupPoint] = useState<RoutePoint|null>(()=>routePoint({lat:Number(params.get("plat")??NaN),lng:Number(params.get("plng")??NaN)}));
  const [dropPoint, setDropPoint] = useState<RoutePoint|null>(()=>routePoint({lat:Number(params.get("dlat")??NaN),lng:Number(params.get("dlng")??NaN)}));
  const [roadRoute, setRoadRoute] = useState<BookingRoute|null>(null);
  const requiresRoadRoute = ["point_to_point","outstation","airport_transfer"].includes(bookingType);
  const [quoteError, setQuoteError] = useState<string|null>(null);
  const [quoteRefresh, setQuoteRefresh] = useState(0);
  const choosePickup=useCallback((point:RoutePoint|null,label?:string)=>{setPickupPoint(point);setRoadRoute(null);if(point)setPickup(label??`Map pin (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`);},[]);
  const chooseDrop=useCallback((point:RoutePoint|null,label?:string)=>{setDropPoint(point);setRoadRoute(null);if(point)setDrop(label??`Map pin (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`);},[]);
  const [hours, setHours] = useState(Number(params.get("hrs")) || 0);
  const [days, setDays] = useState(
    Number(params.get("days")) || (spotsParam ? spotsParam.split(",").length : 0),
  );
  const [nights, setNights] = useState(Number(params.get("nights")) || 0);
  const [notes, setNotes] = useState(params.get("notes") ?? "");
  const [couponCode, setCouponCode] = useState(params.get("coupon") ?? "");
  const [couponInfo, setCouponInfo] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

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
          setLoadErr(null);
          const [res, vehicleRes] = await Promise.all([
            fetch(`/api/packages/${encodeURIComponent(packageSlug)}`, { cache: "no-store" }),
            vehicleId ? fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}`, { cache: "no-store" }) : null,
          ]);
          if (vehicleRes && !vehicleRes.ok) throw new Error("Selected vehicle not found. Choose another vehicle or package.");
          const selectedVehicle = vehicleRes ? (await vehicleRes.json()).vehicle : null;
          if (!res.ok) throw new Error("Package not found.");
          const { package: pkg } = await res.json();
          if (cancelled) return;
          if (pkg.isBookable === false) throw new Error("This package is temporarily unavailable. Choose another trip or contact the team.");
          if (pkg.isGuided && !guidedPath.length) throw new Error("Choose your route on the package page before continuing.");
          const selectedRoute = pkg.tripContent?.routeTree ? selectPackageRoute(pkg.tripContent.routeTree, guidedPath, pkg.basePricePerPerson, new Map(pkg.routeDestinations.map((spot:{id:number;name:string})=>[spot.id,spot.name]))) : undefined;
          setPackagePreview(pkg.tripContent ? { content: pkg.tripContent, selectedRoute } : null);
          setMeta({
            title: pkg.name,
            subtitle: `${selectedVehicle ? `${selectedVehicle.name} · ` : ""}${pkg.regionName} · ${selectedRoute?.days ?? pkg.durationDays} days · ${selectedRoute ? selectedRoute.stops.map(stop=>stop.name).join(" → ") : pkg.destinations.join(" → ")}`,
            pricePerPerson: selectedRoute?.pricePerPerson ?? pkg.pricePerPerson,
          });
          setDays(selectedRoute?.days ?? pkg.durationDays);
          setCapacity(selectedVehicle ? Math.min(pkg.maxPersons, selectedVehicle.seatingCapacity) : pkg.maxPersons);
          setNights(selectedRoute?.nights ?? Math.max(0, pkg.durationDays - 1));
        } else if (mode === "custom" && spotsParam) {
          const ids = spotsParam
            .split(",")
            .map((s) => Number(s))
            .filter(Number.isInteger);
          setStopIds(ids);
          const [regRes, vtRes, vehicleRes] = await Promise.all([
            fetch("/api/regions"),
            fetch("/api/vehicle-types"),
            vehicleId ? fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}`, { cache: "no-store" }) : null,
          ]);
          if (vehicleRes && !vehicleRes.ok) throw new Error("Selected vehicle not found. Choose another vehicle.");
          const selectedVehicle = vehicleRes ? (await vehicleRes.json()).vehicle : null;
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
          if (selectedVehicle) setCapacity(selectedVehicle.seatingCapacity);
          setMeta({
            title: `Custom ${params.get("regionName") ?? "trip"} package`,
            subtitle: `${selectedVehicle ? `${selectedVehicle.name} · ` : ""}${names.length ? names.join(" → ") : `${ids.length} stops`}`,
          });
          if (!days) setDays(ids.length);
        } else if (mode === "vehicle" && vehicleId) {
          const [vRes, vtRes] = await Promise.all([
            fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}`),
            fetch("/api/vehicle-types"),
          ]);
          if (!vRes.ok) throw new Error("Vehicle not found.");
          const { vehicle } = await vRes.json();
          setCapacity(vehicle.seatingCapacity);
          const { vehicleTypes } = await vtRes.json();
          if (cancelled) return;
          const vt = vehicleTypes.find(
            (t: { slug: string }) => t.slug === vehicle.typeSlug,
          );
          setVehicleTypeId(vt?.id ?? null);
          setMeta({
            title: vehicle.name,
            subtitle: `${vehicle.typeTitle} · ${vehicle.seatingCapacity} seats${vehicle.pricePerKm?` · ${inr(vehicle.pricePerKm)}/km`:" · Fare calculated from your trip"}`,
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
  }, [mode, packageSlug, vehicleId, spotsParam, packageRefresh, guidedPath]);

  // ---- live quote ----
  const quoteBody = useMemo(() => {
    const body: Record<string, unknown> = { bookingType, passengers };
    if (vehicleId) body.vehicleId = Number(vehicleId);
    if (requiresRoadRoute && roadRoute) { body.routeId=roadRoute.id;body.pickupPoint=pickupPoint;body.dropPoint=dropPoint; }
    if (bookingType === "package") {
      if (packageSlug) body.packageSlug = packageSlug;
      if (guidedPath.length) body.guidedPath = guidedPath;
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
    if (couponCode.trim()) body.couponCode = couponCode.trim();
    if (validDateTime(startDate)) body.startDate = bookingInstant(startDate).toISOString();
    if (bookingType === "outstation" && validDateTime(endDate)) body.endDateTime = bookingInstant(endDate).toISOString();
    return body;
  }, [bookingType, passengers, packageSlug, days, nights, vehicleTypeId, distanceKm, hours, couponCode, startDate, endDate, vehicleId, requiresRoadRoute, roadRoute, pickupPoint, dropPoint, guidedPath]);

  useEffect(() => {
    if (!enabled || !meta) { setQuoting(false); return; }
    const controller = new AbortController();
    // Invalidate the old estimate immediately, including during the debounce.
    setQuote(null);
    setCouponInfo(null);
    setCouponError(null);
    setQuoteError(null);
    if ((requiresRoadRoute && !roadRoute) || !validDateTime(startDate) || (bookingType === "outstation" && (!validDateTime(endDate) || bookingInstant(endDate) <= bookingInstant(startDate)))) { setQuoting(false); return; }
    setQuoting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quoteBody),
          signal: controller.signal,
        });
        const data = await res.json();
        if (controller.signal.aborted) return;
        setQuote(res.ok ? data.quote : null);
        setQuoteError(res.ok ? null : data.error ?? "Could not calculate a fare. Please try again.");
        setCouponInfo(res.ok ? (data.coupon ?? null) : null);
        setCouponError(res.ok ? (data.couponError ?? null) : null);
      } catch {
        if (!controller.signal.aborted) { setQuote(null); setQuoteError("Could not reach the pricing service. Please try again."); }
      } finally {
        if (!controller.signal.aborted) setQuoting(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [quoteBody, meta, roadRoute, requiresRoadRoute, quoteRefresh, bookingType, startDate, endDate, enabled]);

  const currentUrlWithState = useCallback(() => {
    const p = new URLSearchParams(params.toString());
    p.set("start", startDate);
    if (endDate) p.set("end", endDate);
    p.set("pax", String(passengers));
    if (pickupAddress) p.set("pickup", pickupAddress);
    if (dropAddress) p.set("drop", dropAddress);
    if (distanceKm) p.set("km", String(distanceKm));
    if (pickupPoint) {p.set("plat",String(pickupPoint.lat));p.set("plng",String(pickupPoint.lng));}
    if (dropPoint) {p.set("dlat",String(dropPoint.lat));p.set("dlng",String(dropPoint.lng));}
    if (hours) p.set("hrs", String(hours));
    if (days) p.set("days", String(days));
    if (nights) p.set("nights", String(nights));
    if (notes) p.set("notes", notes);
    if (mode === "generic" || mode === "vehicle") p.set("type", bookingType);
    return `/booking/new?${p.toString()}`;
  }, [
    params, startDate, passengers, pickupAddress, dropAddress, distanceKm, hours,
    days, nights, notes, mode, bookingType, pickupPoint, dropPoint, endDate,
  ]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!validDateTime(startDate) || bookingInstant(startDate).getTime() <= Date.now()) {
      setError("Please choose a travel date and time.");
      return;
    }
    if (!quote || (requiresRoadRoute && !roadRoute)) {setError("Choose locations and wait for a valid fare before confirming.");return;}
    if (bookingType === "outstation" && !duration) { setError("Choose a return date and time after pickup."); return; }

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(currentUrlWithState())}`);
      return;
    }
    if (!isValidPhone(contactPhone)) { setError("Enter a contact number so we can coordinate your trip."); return; }

    setSubmitting(true);
    const payload: Record<string, unknown> = {
      bookingType,
      startDateTime: bookingInstant(startDate).toISOString(),
      ...(bookingType === "outstation" ? { endDateTime: bookingInstant(endDate).toISOString() } : {}),
      passengerCount: passengers,
      ...(vehicleId ? { vehicleId: Number(vehicleId) } : {}),
      pickupAddress: pickupAddress || undefined,
      dropAddress: dropAddress || undefined,
      customerNotes: notes || undefined,
      couponCode: couponCode.trim() || undefined,
      expectedTotal: quote.totalAmount,
      ...(packageSlug ? { expectedPackageFingerprint: quote.packageFingerprint, guidedPath } : {}),
      passengers: [{ name: user.name, phone: normalizePhone(contactPhone), isPrimary: true }],
      ...(requiresRoadRoute&&roadRoute?{routeId:roadRoute.id,pickupPoint,dropPoint}:{}),
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
        if (res.status===409) { setQuoteRefresh(n=>n+1); if(packageSlug){setQuote(null);setMeta(null);setPackageRefresh(n=>n+1);} }
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
          {packageSlug&&<Button href={`/packages/${encodeURIComponent(packageSlug)}`} variant="primary" size="sm">Review this package</Button>}
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
  const showDays = bookingType === "package" && mode !== "curated";
  const showDrop = bookingType === "point_to_point" || bookingType === "airport_transfer" || bookingType === "outstation";

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
        {mode === "custom" && <p className="rounded-xl border border-line bg-surface-muted p-3 text-sm text-muted">Custom vehicle itinerary. Your selected car’s configured trip rate or daily hire rate applies. Hotels, meals, guide services and extras are included only when listed in a published package.</p>}
        {packagePreview&&<section className="space-y-4 rounded-2xl border border-line p-4">
          {packagePreview.content.guideIncluded&&<p className="text-sm font-semibold text-fg">Guide / trip leader included</p>}
          <div className="grid gap-4 sm:grid-cols-2">{([['inclusions','Included in your price'],['exclusions','Excluded / additional charges']] as const).map(([key,label])=><div key={key}><h3 className="text-sm font-semibold text-fg">{label}</h3><ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">{packagePreview.content[key].map((line,i)=><li key={i}>{line}</li>)}</ul>{!packagePreview.content[key].length&&<p className="mt-2 text-xs text-muted">Confirm these details with the team before payment.</p>}</div>)}</div>
          <details><summary className="min-h-11 cursor-pointer text-sm font-medium text-fg">Review itinerary, included meals and hotel stays</summary><div className="mt-4"><PackagePlanView content={packagePreview.content} selectedRoute={packagePreview.selectedRoute}/></div></details>
        </section>}

        {(mode === "vehicle" || mode === "generic") && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">Trip type</span>
            <Select
              aria-label="Trip type"
              className={fieldCls}
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value as BookingTypeCode)}
            >
              {BOOKING_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </Select>
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeSelector label="Start date & time" value={startDate} onChange={setStart}/>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">Passengers</span>
            <input
              type="number"
              min={1}
              max={capacity}
              className={fieldCls}
              value={passengers}
              onChange={(e) => setPassengers(Math.max(1, Number(e.target.value)))}
            />
          </label>
        </div>

        {bookingType === "outstation" && <div className="space-y-2">
          <DateTimeSelector label="Return date & time" value={endDate} onChange={setEnd} min={startDate}/>
          <p className="text-sm text-muted">{duration ? `${duration.days} ${duration.days === 1 ? "day" : "days"} · ${duration.nights} nights. You and the chauffeur return together.` : "Choose when your group returns. Daily allowances follow calendar dates in India."} The route includes both directions; no empty-return fee applies.</p>
        </div>}

        {requiresRoadRoute&&<TripRouteSelector enabled={enabled} roundTrip={bookingType==="outstation"} pickup={pickupPoint} drop={dropPoint} pickupLabel={pickupAddress} dropLabel={dropAddress} onPickup={choosePickup} onDrop={chooseDrop} onRoute={setRoadRoute}/>}

        <details open={!requiresRoadRoute} className="rounded-xl border border-line p-3">
          <summary className="min-h-8 cursor-pointer text-sm font-medium text-fg">{requiresRoadRoute ? "Exact pickup / drop instructions (optional)" : "Pickup details"}</summary>
          <div className="mt-3 space-y-3">
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
          </div>
        </details>

        <div className="grid gap-4 sm:grid-cols-3">
          {showDistance && (
            <label className={requiresRoadRoute ? "sr-only" : "block"}>
              <span className="mb-1.5 block text-xs font-semibold text-muted">Distance (km)</span>
              <input
                type="number"
                min={0}
                className={fieldCls}
                readOnly={requiresRoadRoute}
                tabIndex={requiresRoadRoute ? -1 : undefined}
                aria-label="Distance (km)"
                value={requiresRoadRoute ? roadRoute?.distanceKm ?? "" : distanceKm || ""}
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

        {user && <div>
          <label htmlFor="booking-contact-phone" className="mb-1.5 block text-xs font-semibold text-muted">Booking contact number</label>
          <input id="booking-contact-phone" aria-describedby="booking-contact-help" type="tel" autoComplete="tel" required maxLength={30} className={fieldCls} value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="Mobile number for trip updates" />
          <p id="booking-contact-help" className="mt-1 text-xs text-muted">We’ll use this number to coordinate pickup and your trip.</p>
        </div>}

        <details className="rounded-xl border border-line p-3" open={Boolean(params.get("coupon") || params.get("notes"))}>
          <summary className="min-h-8 cursor-pointer text-sm font-medium text-fg">Add a note or discount code (optional)</summary>
          <div className="mt-3 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">Notes (optional)</span>
          <textarea
            rows={2}
            className={fieldCls}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">Discount code (optional)</span>
          <input
            type="text"
            className={`${fieldCls} uppercase`}
            placeholder="e.g. WELCOME10"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
          />
          {couponInfo && (
            <span className="mt-1 block text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Code {couponInfo.code} applied — you save {inr(couponInfo.discountAmount)}.
            </span>
          )}
          {couponError && (
            <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">
              {couponError}
            </span>
          )}
        </label>

          </div>
        </details>
        {quoteError&&<p role="alert" className="rounded-xl border border-red-400/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">{quoteError}</p>}
        {error && (
          <p role="alert" className="rounded-xl border border-red-400/30 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {quote&&<div aria-live="polite" className="space-y-3 rounded-xl border border-line p-4 lg:hidden">
          <ul className="space-y-2 text-sm">{quote.breakdown.map(line=><li key={line.label} className="flex justify-between gap-3"><span className="text-muted">{line.label}</span><span className="shrink-0 font-medium text-fg">{inr(line.amount)}</span></li>)}</ul>
          <p className="border-t border-line pt-3 text-base font-semibold text-fg">Estimated total: {inr(quote.totalAmount)}</p>
        </div>}
        <Button type="submit" variant="accent" size="lg" fullWidth loading={submitting} disabled={!quote||quoting||(requiresRoadRoute&&!roadRoute)}>
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

      <aside className="hidden lg:block">
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
          <ul className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-muted">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
              Verified chauffeur &amp; well-maintained vehicle
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
              Transparent private-vehicle pricing
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
              Book now, pay offline — no card needed
            </li>
          </ul>
          <p className="mt-4 text-xs text-faint">
            <Link href="/policy/cancellation" className="hover-underline">
              Cancellation policy
            </Link>
          </p>
        </Card>
      </aside>
    </div>
  );
}
