"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/common/Section";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import Skeleton from "@/components/common/Skeleton";
import BookingStatusBadge from "@/components/booking/BookingStatusBadge";
import { useAuth } from "@/context/AuthContext";

interface BookingSummary {
  id: string;
  reference: string;
  status: string;
  bookingTypeCode: string;
  startDateTime: string;
  totalAmount: number;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function ProfileBookingsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [bookings, setBookings] = useState<BookingSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?redirect=/profile/bookings");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/bookings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setBookings(d.bookings))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <Section bg="gray" eyebrow="Your account" title="My bookings">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/profile"
          className="hover-underline mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-300"
        >
          <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
          Back to profile
        </Link>

        {isLoading || !user || (!bookings && !failed) ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : failed ? (
          <Card padded hover={false} className="text-center">
            <p className="text-sm text-muted">Couldn&apos;t load your bookings.</p>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => location.reload()}>
                Retry
              </Button>
            </div>
          </Card>
        ) : bookings && bookings.length === 0 ? (
          <Card padded hover={false} className="text-center">
            <p className="text-sm text-muted">You haven&apos;t booked a trip yet.</p>
            <div className="mt-4 flex justify-center gap-3">
              <Button href="/packages" variant="accent" size="sm">
                Browse packages
              </Button>
              <Button href="/vehicles" variant="outline" size="sm">
                Browse vehicles
              </Button>
            </div>
          </Card>
        ) : (
          <ul className="space-y-4">
            {bookings!.map((b) => (
              <li key={b.id}>
                <Link href={`/profile/bookings/${b.id}`} className="block">
                  <Card padded className="transition-shadow hover:shadow-card-hover">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-fg">{b.reference}</span>
                          <BookingStatusBadge status={b.status} />
                        </div>
                        <p className="mt-1 text-sm capitalize text-muted">
                          {b.bookingTypeCode.replace(/_/g, " ")} ·{" "}
                          {new Date(b.startDateTime).toLocaleDateString("en-IN", {
                            dateStyle: "medium",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-lg font-bold text-primary-900 dark:text-primary-300">
                          {inr(b.totalAmount)}
                        </p>
                        <span className="text-xs text-accent-600">View details →</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
