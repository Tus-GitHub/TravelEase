import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import Section from "@/components/common/Section";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import { getUserIdForToken, SESSION_COOKIE } from "@/lib/server/session";
import { findUserById, toPublicUser } from "@/lib/server/users";
import { getBookingForUser } from "@/lib/server/bookings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking confirmed — TravelEase",
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default async function BookingConfirmPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = await getUserIdForToken(cookies().get(SESSION_COOKIE)?.value);
  if (!userId) {
    redirect(`/login?redirect=${encodeURIComponent(`/booking/${params.id}/confirm`)}`);
  }
  const row = await findUserById(userId);
  if (!row) {
    redirect(`/login?redirect=${encodeURIComponent(`/booking/${params.id}/confirm`)}`);
  }

  const booking = await getBookingForUser(params.id, toPublicUser(row));
  if (!booking) notFound();

  const bd = booking.priceBreakdown;
  const start = new Date(booking.startDateTime).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Section bg="gray">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950">
            <Icon name="check" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-fg">Booking received</h1>
            <p className="text-sm text-muted">
              Reference <span className="font-semibold text-fg">{booking.reference}</span> ·{" "}
              {booking.status}
            </p>
          </div>
        </div>

        <Card padded hover={false} className="mt-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">Trip type</dt>
              <dd className="mt-1 font-medium text-fg">{booking.bookingTypeCode.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">Starts</dt>
              <dd className="mt-1 font-medium text-fg">{start}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">Passengers</dt>
              <dd className="mt-1 font-medium text-fg">{booking.passengerCount}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">Total</dt>
              <dd className="mt-1 font-display text-lg font-bold text-primary-900 dark:text-primary-300">
                {inr(booking.totalAmount)}
              </dd>
            </div>
          </dl>

          {booking.stops.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">Itinerary</p>
              <p className="mt-1.5 text-sm text-fg">
                {booking.stops.map((s) => s.name ?? s.customLabel ?? "Stop").join("  →  ")}
              </p>
            </div>
          )}

          {bd && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">Price breakdown</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {bd.breakdown.map((l) => (
                  <li key={l.label} className="flex justify-between gap-4">
                    <span className="text-muted">{l.label}</span>
                    <span className="font-medium text-fg">{inr(l.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-4 border-t border-line pt-1.5">
                  <span className="font-semibold text-fg">Total</span>
                  <span className="font-semibold text-fg">{inr(bd.totalAmount)}</span>
                </li>
              </ul>
            </div>
          )}
        </Card>

        <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          <p className="font-medium text-fg">What happens next</p>
          <p className="mt-1">
            Your booking is <strong>pending payment</strong>. TravelEase will review it and
            contact you to confirm the trip and arrange offline payment.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/profile/bookings" variant="accent">
            View my bookings
          </Button>
          <Button href="/packages" variant="outline">
            Browse more trips
          </Button>
        </div>

        <p className="mt-4 text-xs text-faint">
          Need to change something?{" "}
          <Link href="/contact" className="hover-underline">
            Contact us
          </Link>
          .
        </p>
      </div>
    </Section>
  );
}
