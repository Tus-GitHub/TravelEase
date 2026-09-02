"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Section from "@/components/common/Section";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import Skeleton from "@/components/common/Skeleton";
import BookingStatusBadge from "@/components/booking/BookingStatusBadge";
import { useAuth } from "@/context/AuthContext";
import { useSiteContact } from "@/context/SiteContactContext";
import { calculateRefund } from "@/lib/refund";

interface Stop {
  name: string | null;
  customLabel: string | null;
  nightsHere?: number;
}
interface Passenger {
  name: string;
  age: number | null;
  phone: string | null;
  isPrimary: boolean;
}
interface StatusEvent {
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  changedAt: string;
}
interface Line {
  label: string;
  amount: number;
}
interface Refund {
  amount: number;
  chargeAmount: number;
  tier: string;
  status: "pending" | "paid" | "waived";
  reason: string | null;
}
interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  isPublished: boolean;
}
interface Booking {
  id: string;
  reference: string;
  status: string;
  bookingTypeCode: string;
  startDateTime: string;
  passengerCount: number;
  pickupAddress: string | null;
  dropAddress: string | null;
  totalAmount: number;
  customerNotes: string | null;
  priceBreakdown: { breakdown: Line[]; totalAmount: number } | null;
  stops: Stop[];
  passengers: Passenger[];
  history: StatusEvent[];
  refund: Refund | null;
  review: Review | null;
  driver: { name: string; phone: string | null } | null;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const CANCELLABLE = new Set(["PendingPayment", "Confirmed"]);

export default function BookingDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();
  const contact = useSiteContact();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?redirect=/profile/bookings/${id}`);
  }, [isLoading, user, router, id]);

  const load = useCallback(() => {
    if (!user || !id) return;
    setState("loading");
    fetch(`/api/bookings/${id}`)
      .then(async (r) => {
        if (r.status === 404) return setState("notfound");
        if (!r.ok) return setState("error");
        const d = await r.json();
        setBooking(d.booking);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [user, id]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async () => {
    let prompt = "Cancel this booking? This can't be undone.";
    if (booking && booking.status === "Confirmed") {
      const est = calculateRefund({
        totalAmount: booking.totalAmount,
        pickupAt: new Date(booking.startDateTime),
        initiatedBy: "customer",
      });
      prompt += `\n\nBased on our cancellation policy you'd be refunded about ${inr(est.refundAmount)} of ${inr(booking.totalAmount)}.`;
    }
    if (!confirm(prompt)) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled", reason: "Cancelled by customer" }),
      });
      const d = await res.json();
      if (!res.ok) {
        setCancelError(d.error ?? "Couldn't cancel the booking.");
      } else {
        setBooking(d.booking);
      }
    } catch {
      setCancelError("Couldn't reach the server.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Section bg="gray">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/profile/bookings"
          className="hover-underline mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-300"
        >
          <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
          All bookings
        </Link>

        {isLoading || !user || state === "loading" ? (
          <Skeleton className="h-80 w-full" />
        ) : state === "notfound" ? (
          <Card padded hover={false} className="text-center">
            <h1 className="font-display text-xl font-bold text-fg">Booking not found</h1>
            <p className="mt-2 text-sm text-muted">
              It may have been removed, or this isn&apos;t your booking.
            </p>
            <div className="mt-4">
              <Button href="/profile/bookings" variant="accent" size="sm">
                Back to my bookings
              </Button>
            </div>
          </Card>
        ) : state === "error" ? (
          <Card padded hover={false} className="text-center">
            <p className="text-sm text-muted">Couldn&apos;t load this booking.</p>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={load}>
                Retry
              </Button>
            </div>
          </Card>
        ) : booking ? (
          <>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-fg">{booking.reference}</h1>
              <BookingStatusBadge status={booking.status} />
            </div>

            <Card padded hover={false} className="mt-5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <Field label="Trip type" value={booking.bookingTypeCode.replace(/_/g, " ")} />
                <Field
                  label="Starts"
                  value={new Date(booking.startDateTime).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
                <Field label="Passengers" value={String(booking.passengerCount)} />
                <Field label="Total" value={inr(booking.totalAmount)} />
                {booking.pickupAddress && <Field label="Pickup" value={booking.pickupAddress} />}
                {booking.dropAddress && <Field label="Drop" value={booking.dropAddress} />}
              </dl>

              {booking.stops.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-faint">Itinerary</p>
                  <p className="mt-1.5 text-sm text-fg">
                    {booking.stops
                      .map((s) => s.name ?? s.customLabel ?? "Stop")
                      .join("  →  ")}
                  </p>
                </div>
              )}

              {booking.passengers.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-faint">Passengers</p>
                  <ul className="mt-1.5 text-sm text-fg">
                    {booking.passengers.map((p, i) => (
                      <li key={i}>
                        {p.name}
                        {p.isPrimary ? " (primary)" : ""}
                        {p.phone ? ` · ${p.phone}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {booking.priceBreakdown && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-faint">Price breakdown</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {booking.priceBreakdown.breakdown.map((l) => (
                      <li key={l.label} className="flex justify-between gap-4">
                        <span className="text-muted">{l.label}</span>
                        <span className="font-medium text-fg">{inr(l.amount)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-4 border-t border-line pt-1.5">
                      <span className="font-semibold text-fg">Total</span>
                      <span className="font-semibold text-fg">
                        {inr(booking.priceBreakdown.totalAmount)}
                      </span>
                    </li>
                  </ul>
                </div>
              )}

              {booking.customerNotes && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-faint">Your notes</p>
                  <p className="mt-1.5 text-sm text-fg">{booking.customerNotes}</p>
                </div>
              )}
            </Card>

            {booking.refund && (
              <div className="mt-5 rounded-xl border border-line bg-surface px-4 py-4 text-sm">
                <p className="font-semibold text-fg">
                  Refund: {inr(booking.refund.amount)}{" "}
                  <span className="font-normal text-muted">
                    ({booking.refund.status})
                  </span>
                </p>
                {booking.refund.reason && (
                  <p className="mt-1 text-muted">{booking.refund.reason}</p>
                )}
                {booking.refund.status === "pending" ? (
                  <p className="mt-1 text-muted">
                    We&apos;ll process this and get in touch. Refunds go back the way you paid.
                  </p>
                ) : booking.refund.status === "paid" ? (
                  <p className="mt-1 text-emerald-600 dark:text-emerald-400">Refund processed.</p>
                ) : null}
              </div>
            )}

            {booking.driver && (
              <div className="mt-5 rounded-xl border border-line bg-surface px-4 py-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                  Your driver
                </p>
                <p className="mt-1.5 font-semibold text-fg">{booking.driver.name}</p>
                {booking.driver.phone && (
                  <p className="mt-0.5 text-muted">
                    <a
                      href={`tel:${booking.driver.phone.replace(/\s+/g, "")}`}
                      className="font-medium text-primary-700 hover:underline dark:text-primary-300"
                    >
                      {booking.driver.phone}
                    </a>
                  </p>
                )}
                <p className="mt-1 text-xs text-faint">
                  They may call you before pickup. Contact us if anything changes.
                </p>
              </div>
            )}

            {booking.status === "PendingPayment" && (
              <div className="mt-5 rounded-xl border border-accent-400/40 bg-accent-50 px-4 py-4 text-sm dark:bg-accent-950/20">
                <p className="font-semibold text-fg">Pay by phone to confirm</p>
                <p className="mt-1 text-muted">
                  Call{" "}
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                    className="font-semibold text-accent-700 hover:underline dark:text-accent-300"
                  >
                    {contact.phone}
                  </a>{" "}
                  and quote{" "}
                  <strong className="text-fg">{booking.reference}</strong>.
                </p>
              </div>
            )}

            <Card padded hover={false} className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">History</p>
              <ol className="mt-3 space-y-2 text-sm">
                {booking.history.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-muted">
                    <span className="font-medium text-fg">
                      {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                    </span>
                    <span className="text-xs">
                      {new Date(h.changedAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    {h.reason && <span className="text-xs italic">— {h.reason}</span>}
                  </li>
                ))}
              </ol>
            </Card>

            {CANCELLABLE.has(booking.status) && (
              <div className="mt-6">
                {cancelError && (
                  <p className="mb-2 text-sm text-red-600 dark:text-red-400">{cancelError}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancel}
                  loading={cancelling}
                >
                  Cancel booking
                </Button>
                <p className="mt-2 text-xs text-faint">
                  Refunds follow the{" "}
                  <Link href="/policy/cancellation" className="hover-underline">
                    cancellation policy
                  </Link>
                  .
                </p>
              </div>
            )}

            {booking.status === "Completed" && (
              <ReviewForm
                bookingId={booking.id}
                existing={booking.review}
                onSaved={load}
              />
            )}
          </>
        ) : null}
      </div>
    </Section>
  );
}

function ReviewForm({
  bookingId,
  existing,
  onSaved,
}: {
  bookingId: string;
  existing: Review | null;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (rating < 1) {
      setErr("Pick a star rating.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, rating, title, body }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Couldn't save your review.");
    } else {
      setDone(true);
      onSaved();
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-4">
      <p className="font-semibold text-fg">
        {existing ? "Your review" : "How was your trip?"}
      </p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={`text-2xl leading-none ${
              n <= rating ? "text-accent-500" : "text-line"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <input
        className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        placeholder="Title (optional)"
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        rows={3}
        placeholder="Tell other travellers about your trip"
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {err && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{err}</p>}
      {done && (
        <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
          Thanks — your review is saved.
        </p>
      )}
      <div className="mt-3">
        <Button variant="accent" size="sm" onClick={submit} loading={busy}>
          {existing ? "Update review" : "Post review"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-1 font-medium capitalize text-fg">{value}</dd>
    </div>
  );
}
