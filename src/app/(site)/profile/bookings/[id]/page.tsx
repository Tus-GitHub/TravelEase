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
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const CANCELLABLE = new Set(["PendingPayment", "Confirmed"]);

export default function BookingDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();

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
    if (!confirm("Cancel this booking? This can't be undone.")) return;
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
          </>
        ) : null}
      </div>
    </Section>
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
