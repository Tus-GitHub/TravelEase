"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Button from "@/components/common/Button";
import DestinationPhoto from "@/components/common/DestinationPhoto";
import Icon from "@/components/common/Icon";
import DateInput from "@/components/controls/DateInput";
import { useAuth } from "@/context/AuthContext";
import { useSiteContact } from "@/context/SiteContactContext";
import { suggestionPath, type RouteTemplate } from "@/lib/route-templates";
import type { Region } from "@/types";

const field =
  "mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-fg transition-colors focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20";

function StepBar({ step }: { step: 2 | 3 }) {
  const steps = [
    { num: 1, label: "Region", done: true },
    { num: 2, label: "Build Route", done: step === 3, active: step === 2 },
    { num: 3, label: "Request Quote", done: false, active: step === 3 },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle pb-4 text-xs font-semibold">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
              s.active
                ? "bg-accent-500 text-slate-950 shadow-sm"
                : s.done
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-surface-muted text-muted"
            }`}
          >
            {s.done ? <Icon name="check" className="h-3.5 w-3.5" /> : <span>{s.num}.</span>}
            <span>{s.label}</span>
          </span>
          {i < steps.length - 1 && <Icon name="arrow-right" className="h-3.5 w-3.5 text-faint" />}
        </div>
      ))}
    </div>
  );
}

function RouteRequest({ route, vehicleId }: { route: RouteTemplate; vehicleId?: number }) {
  const { user, isLoading } = useAuth();
  const contact = useSiteContact();
  const [path, setPath] = useState<number[]>(
    route.tree.roots.length === 1 ? [route.tree.roots[0]] : []
  );
  const [review, setReview] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [travellers, setTravellers] = useState("2");
  const [vehicleTier, setVehicleTier] = useState("");
  const [callbackWindow, setCallbackWindow] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState<{ id: string; reference: string } | null>(null);
  const inFlight = useRef(false);
  const key = "route-request-" + route.id;

  const places = useMemo(
    () => new Map(route.places.map((place) => [place.id, place])),
    [route.places]
  );
  const nodes = useMemo(
    () => new Map(route.tree.nodes.map((node) => [node.spotId, node])),
    [route.tree]
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.expires > Date.now()) {
          suggestionPath(route.tree, saved.path);
          setPath(saved.path);
          setEmail(saved.email || "");
          setPhone(saved.phone || "");
          setDate(saved.date || "");
          setTravellers(saved.travellers || "2");
          setNotes(saved.notes || "");
          const savedLast = nodes.get(saved.path[saved.path.length - 1]);
          setReview(Boolean(saved.review && (saved.path.length >= 2 || !savedLast?.next.length)));
        } else {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      sessionStorage.removeItem(key);
    }
    setStorageReady(true);
  }, [key, route.tree, nodes]);

  useEffect(() => {
    if (storageReady && !ticket) {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({
            path,
            email,
            phone,
            date,
            travellers,
            notes,
            review,
            expires: Date.now() + 86400000,
          })
        );
      } catch {
        /* The route still works without browser storage. */
      }
    }
  }, [key, path, email, phone, date, travellers, notes, review, ticket, storageReady]);

  useEffect(() => {
    if (user) {
      setEmail((current) => current || user.email);
      setPhone((current) => current || user.phone);
    }
  }, [user]);

  const last = nodes.get(path[path.length - 1]);
  const choices = last?.next ?? route.tree.roots;
  const canReview = path.length >= 2 || (path.length === 1 && choices.length === 0);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!user || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const extraPrefs = [
        vehicleTier ? `Vehicle preference: ${vehicleTier}` : "",
        callbackWindow ? `Best callback time: ${callbackWindow}` : "",
      ].filter(Boolean);
      const combinedNotes = [...extraPrefs, notes.trim()].filter(Boolean).join("\n");
      const response = await fetch("/api/route-enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: route.id,
          path,
          email,
          phone,
          date,
          travellers: Number(travellers),
          notes: combinedNotes.slice(0, 1000),
          ...(vehicleId ? { vehicleId } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Could not send the booking request.");
      setTicket(data.ticket);
      sessionStorage.removeItem(key);
    } catch (e) {
      setError(
        (e as Error).message ||
          "Could not confirm your request. Check My Support before sending again."
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (ticket) {
    return (
      <div
        role="status"
        className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Icon name="check" className="h-6 w-6" />
          </span>
          <div>
            <h3 className="font-display text-2xl font-bold text-fg">Booking request received</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Reference <span className="font-mono font-semibold text-fg">{ticket.reference}</span>. Your route and contact details are saved. Our team will discuss your trip and price by phone before a booking is confirmed.
            </p>
            <Link
              href={"/profile/support/" + ticket.id}
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent-600 underline underline-offset-4 dark:text-accent-400"
            >
              View your booking request
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Build your own route"
      className="min-w-0 space-y-6 rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-8"
    >
      <StepBar step={review ? 3 : 2} />

      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-600 dark:text-accent-400">
          <Icon name="map-pin" className="h-3 w-3" />
          {review ? "Final step · booking request" : "Choose stops · your route"}
        </span>
        <h3 className="mt-2.5 font-display text-2xl font-bold text-fg sm:text-3xl">{route.name}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Choose where to go and stop. You arrange your own hotels; our team discusses the travel price and final details with you by phone.
        </p>
      </div>

      {/* Connected Route Journey Bar */}
      {path.length > 0 && (
        <div className="rounded-2xl border border-line-subtle bg-surface-muted/70 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Your Journey ({path.length} {path.length === 1 ? "stop" : "stops"})
            </span>
            {path.length > 1 && !review && (
              <span className="text-xs text-faint">Click any stop to rewind</span>
            )}
          </div>
          <ol aria-label="Your selected route" className="flex flex-wrap items-center gap-2.5">
            {path.map((id, index) => {
              const place = places.get(id);
              const hasPhoto = Boolean(place?.imageUrl);
              return (
                <li key={id} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Change route from ${place?.name}`}
                    onClick={() => {
                      setPath(path.slice(0, index + 1));
                      setReview(false);
                    }}
                    className="group flex min-h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface py-1.5 pl-1.5 pr-4 text-left shadow-sm transition-all hover:border-accent-500 hover:shadow"
                  >
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-900 text-xs font-bold text-white">
                      {hasPhoto ? (
                        <DestinationPhoto
                          imageUrl={place!.imageUrl}
                          alt=""
                          decorative
                          sizes="36px"
                        />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </span>
                    <span className="leading-tight">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-accent-600 dark:text-accent-400">
                        {index === 0 ? "Start" : `Stop ${index + 1}`}
                      </span>
                      <span className="block text-sm font-bold text-fg">
                        {index > 0 ? "→ " : ""}
                        {place?.name}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!review && choices.length > 0 && (
              <li aria-hidden="true" className="flex items-center">
                <span className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl border border-dashed border-line px-3.5 text-xs font-medium text-muted">
                  <Icon name="arrow-right" className="h-3.5 w-3.5 text-accent-500" />
                  Pick next stop
                </span>
              </li>
            )}
          </ol>
        </div>
      )}

      {!review ? (
        <>
          <fieldset>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <legend className="font-display text-lg font-bold text-fg sm:text-xl">
                {last ? `Where next after ${places.get(last.spotId)?.name}?` : "Choose a starting point"}
              </legend>
              {choices.length > 0 && (
                <span className="text-xs font-medium text-muted">
                  {choices.length} {choices.length === 1 ? "destination" : "destinations"} available
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {choices.map((id) => {
                const place = places.get(id);
                const hasPhoto = Boolean(place?.imageUrl);
                const subtitle =
                  place?.cityName && place.cityName !== place.name
                    ? place.cityName
                    : "Suggested next stop";
                return (
                  <button
                    key={id}
                    data-route-choice={id}
                    type="button"
                    onClick={() => {
                      setPath([...path, id]);
                      setError("");
                    }}
                    className="group relative flex h-48 flex-col justify-between overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 p-4 text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-accent-400 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                  >
                    {hasPhoto && (
                      <DestinationPhoto
                        imageUrl={place!.imageUrl}
                        alt={place?.name ?? "Destination"}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    )}
                    <div
                      className={`absolute inset-0 transition-opacity duration-300 ${
                        hasPhoto
                          ? "bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/20 group-hover:via-slate-950/25"
                          : "bg-gradient-to-t from-slate-950/80 via-primary-900/40 to-transparent"
                      }`}
                    />

                    <div className="relative z-10 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-slate-950/55 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
                        <Icon name="map-pin" className="h-3 w-3 text-accent-400" />
                        {subtitle}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm transition-colors group-hover:bg-accent-500 group-hover:text-slate-950">
                        + Add
                      </span>
                    </div>

                    <div className="relative z-10">
                      <span className="block font-display text-xl font-bold tracking-tight text-white">
                        {place?.name} →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {last && !choices.length && (
              <p className="mt-4 rounded-2xl border border-line bg-surface-muted p-4 text-sm text-muted">
                You have reached the end of this branch. Continue to request your booking, or change an earlier stop.
              </p>
            )}
          </fieldset>

          {path.length === 1 && choices.length > 0 && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-accent-500/30 bg-accent-500/10 px-4 py-3 text-sm font-medium text-fg">
              <Icon name="map-pin" className="h-4 w-4 shrink-0 text-accent-500" />
              <span>Select at least one destination above to choose where you want to go.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
            {canReview && (
              <Button variant="accent" size="lg" iconRight="arrow-right" onClick={() => setReview(true)}>
                Review &amp; request booking
              </Button>
            )}
            {path.length > 1 && (
              <Button variant="outline" onClick={() => setPath(path.slice(0, -1))}>
                Previous stop
              </Button>
            )}
          </div>
        </>
      ) : (
        <form onSubmit={send} className="space-y-5 border-t border-line pt-6">
          <div>
            <h4 className="font-display text-xl font-bold text-fg">Your contact details</h4>
            <p className="mt-1 text-sm text-muted">
              Send this route as a booking request. We’ll contact you to discuss your stops, vehicle and price.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-semibold text-fg">
              Email
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={field}
              />
            </label>
            <label className="min-w-0 text-sm font-semibold text-fg">
              Phone number
              <input
                type="tel"
                autoComplete="tel"
                required
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={field}
              />
            </label>
            <label className="min-w-0 text-sm font-semibold text-fg">
              Preferred start date (optional)
              <DateInput
                aria-label="Preferred start date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={field}
              />
            </label>
            <label className="min-w-0 text-sm font-semibold text-fg">
              Travellers
              <input
                type="number"
                min={1}
                max={100}
                required
                value={travellers}
                onChange={(e) => setTravellers(e.target.value)}
                className={field}
              />
            </label>
            <label className="min-w-0 text-sm font-semibold text-fg">
              Preferred vehicle (optional)
              <select
                value={vehicleTier}
                onChange={(e) => setVehicleTier(e.target.value)}
                className={field}
              >
                <option value="">Any suitable vehicle</option>
                <option value="Sedan (up to 4 seats)">Sedan (up to 4 seats)</option>
                <option value="SUV / Innova (up to 7 seats)">SUV / Innova (up to 7 seats)</option>
                <option value="Tempo Traveller (12–32 seats)">Tempo Traveller (12–32 seats)</option>
              </select>
            </label>
            <label className="min-w-0 text-sm font-semibold text-fg">
              Best time to call (optional)
              <select
                value={callbackWindow}
                onChange={(e) => setCallbackWindow(e.target.value)}
                className={field}
              >
                <option value="">Anytime</option>
                <option value="Morning (9am–12pm)">Morning (9am–12pm)</option>
                <option value="Afternoon (12pm–5pm)">Afternoon (12pm–5pm)</option>
                <option value="Evening (5pm–9pm)">Evening (5pm–9pm)</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold text-fg">
            Stopping preferences and other details (optional)
            <textarea
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tell us where you would like to stop, how long you want to stay, or anything else we should discuss."
              className={field}
            />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted">
            This submits a request, not a confirmed booking. No hotel, meal or fixed price is included. Your contact details are used to discuss this trip.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy}
              type="button"
              onClick={() => setReview(false)}
            >
              Edit my route
            </Button>
            {user ? (
              <Button variant="accent" size="lg" type="submit" loading={busy}>
                Send booking request
              </Button>
            ) : (
              <Button
                variant="accent"
                size="lg"
                disabled={isLoading}
                href={
                  "/login?redirect=" +
                  encodeURIComponent(
                    `/booking?mode=custom&region=${route.regionId}${
                      vehicleId ? "&vehicle=" + vehicleId : ""
                    }`
                  )
                }
              >
                Sign in to send request
              </Button>
            )}
            {(() => {
              const digits = (contact.phone || "").replace(/\D/g, "");
              const wa = digits.length === 10 ? `91${digits}` : digits;
              if (!wa) return null;
              const routeNames = path.map((id) => places.get(id)?.name).filter(Boolean).join(" → ");
              const msg = `Hi Jagdamba Travellers, I'd like a quote for this custom route: ${routeNames}${vehicleTier ? ` (${vehicleTier})` : ""}`;
              return (
                <a
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
                >
                  <Icon name="chat" className="h-4 w-4" />
                  Share on WhatsApp
                </a>
              );
            })()}
          </div>
          {!user && (
            <p className="text-xs text-muted">
              Sign in to keep your booking request private and track replies. Your selected route and form details stay in this browser tab.
            </p>
          )}
        </form>
      )}
    </section>
  );
}

export default function CustomerRoutePlanner({
  region,
  initialSpotId,
  vehicleId,
  onClearPlace,
}: {
  region: Region;
  initialSpotId?: string;
  vehicleId?: number;
  onClearPlace: () => void;
}) {
  const [routes, setRoutes] = useState<RouteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    try {
      const saved = Number(sessionStorage.getItem("selected-route-" + region.id));
      if (saved) setSelected(saved);
    } catch {
      /* Selection remains available without browser storage. */
    }
  }, [region.id]);

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/route-templates", { signal: abort.signal, cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw Error(data.error || "Could not load route suggestions.");
        setRoutes(data.routes);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [attempt]);

  const wanted = region.spots.find((spot) => spot.id === initialSpotId);
  const matching = routes.filter(
    (route) =>
      route.regionId === Number(region.id) &&
      (!wanted ||
        route.places.some(
          (place) => String(place.id) === wanted.id || place.cityName === wanted.cityName
        ))
  );
  const active =
    matching.find((route) => route.id === selected) ??
    (matching.length === 1 ? matching[0] : undefined);

  if (loading) {
    return (
      <p role="status" className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
        Loading suggested routes…
      </p>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Button className="mt-3" variant="outline" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      {wanted && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <p className="text-sm font-medium text-fg">Routes near {wanted.name}</p>
          <Button variant="outline" size="sm" onClick={onClearPlace}>
            Show all routes in {region.name}
          </Button>
        </div>
      )}
      {!matching.length ? (
        <div role="status" className="rounded-2xl border border-line bg-surface p-6">
          <h3 className="text-lg font-semibold text-fg">
            Route suggestions for {region.name} are coming soon
          </h3>
          <p className="mt-2 text-sm text-muted">
            Choose another region while our team prepares these connections.
          </p>
        </div>
      ) : active ? (
        <>
          <RouteRequest key={active.id} route={active} vehicleId={vehicleId} />
          {matching.length > 1 && (
            <Button
              variant="outline"
              onClick={() => {
                setSelected(null);
                try {
                  sessionStorage.removeItem("selected-route-" + region.id);
                } catch {}
              }}
            >
              Choose another route
            </Button>
          )}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {matching.map((route) => (
            <button
              type="button"
              key={route.id}
              onClick={() => {
                setSelected(route.id);
                try {
                  sessionStorage.setItem("selected-route-" + region.id, String(route.id));
                } catch {}
              }}
              className="group min-h-24 rounded-2xl border border-line bg-surface p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-card"
            >
              <span className="block font-display text-lg font-bold text-fg group-hover:text-accent-600 dark:group-hover:text-accent-400">
                {route.name}
              </span>
              <span className="mt-1.5 block text-sm text-muted">
                {route.tree.nodes.length} possible stops · choose your own route
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
