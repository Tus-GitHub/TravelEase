"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Section from "@/components/common/Section";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import Skeleton from "@/components/common/Skeleton";
import { useAuth } from "@/context/AuthContext";

interface TicketSummary {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: string;
  bookingReference: string | null;
  lastMessageAt: string;
  messageCount: number;
}
interface BookingOpt {
  id: string;
  reference: string;
}

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  pending: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-surface-hover text-muted",
};
const CATEGORIES = ["general", "booking", "payment", "refund", "other"];

const fieldCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none transition-[border-color,box-shadow] focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/60";

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_TONE[status] ?? ""}`}>
      {status}
    </span>
  );
}

function SupportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading } = useAuth();

  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [bookings, setBookings] = useState<BookingOpt[]>([]);

  const prefillBooking = params.get("booking") ?? "";
  const [showForm, setShowForm] = useState(!!prefillBooking);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [bookingId, setBookingId] = useState(prefillBooking);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?redirect=/profile/support");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/support-tickets")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setTickets(d.tickets))
      .catch(() => !cancelled && setFailed(true));
    fetch("/api/bookings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setBookings(d.bookings ?? []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const submit = async () => {
    if (subject.trim().length < 3) {
      setErr("Add a short subject.");
      return;
    }
    if (message.trim().length < 3) {
      setErr("Describe the issue in the message.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          message: message.trim(),
          bookingId: bookingId || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? "Couldn't open the ticket.");
        setBusy(false);
        return;
      }
      router.push(`/profile/support/${d.ticket.id}`);
    } catch {
      setErr("Couldn't reach the server. Try again.");
      setBusy(false);
    }
  };

  return (
    <Section bg="gray" eyebrow="Your account" title="Help & support">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/profile"
          className="hover-underline mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-300"
        >
          <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
          Back to profile
        </Link>

        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Questions about a booking, payment or refund? Open a ticket and we&apos;ll reply by email.
          </p>
          {!showForm && (
            <Button size="sm" variant="accent" iconLeft="chat" onClick={() => setShowForm(true)}>
              New ticket
            </Button>
          )}
        </div>

        {showForm && (
          <Card padded hover={false} className="mb-6">
            <h2 className="text-base font-bold text-fg">New support ticket</h2>
            <div className="mt-4 flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Subject</span>
                <input
                  className={fieldCls}
                  maxLength={160}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Briefly, what's this about?"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted">Category</span>
                  <select
                    className={fieldCls}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="capitalize">
                        {c[0].toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted">
                    Related booking (optional)
                  </span>
                  <select
                    className={fieldCls}
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value)}
                  >
                    <option value="">None</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.reference}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Message</span>
                <textarea
                  className={fieldCls}
                  rows={4}
                  maxLength={4000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Give us the details so we can help."
                />
              </label>
              {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
              <div className="flex gap-2">
                <Button variant="accent" size="sm" onClick={submit} loading={busy}>
                  Open ticket
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {isLoading || !user || (!tickets && !failed) ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : failed ? (
          <Card padded hover={false} className="text-center">
            <p className="text-sm text-muted">Couldn&apos;t load your tickets.</p>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => location.reload()}>
                Retry
              </Button>
            </div>
          </Card>
        ) : tickets && tickets.length === 0 ? (
          <Card padded hover={false} className="text-center">
            <p className="text-sm text-muted">No support tickets yet.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {tickets!.map((t) => (
              <li key={t.id}>
                <Link href={`/profile/support/${t.id}`} className="block">
                  <Card padded className="transition-shadow hover:shadow-card-hover">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-fg">{t.subject}</span>
                          <StatusPill status={t.status} />
                        </div>
                        <p className="mt-1 font-mono text-xs text-faint">
                          {t.reference}
                          {t.bookingReference ? ` · booking ${t.bookingReference}` : ""}
                          {` · ${t.messageCount} message${t.messageCount === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-faint">
                        {new Date(t.lastMessageAt).toLocaleDateString("en-IN", {
                          dateStyle: "medium",
                        })}
                      </span>
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

export default function ProfileSupportPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted">Loading…</p>}>
      <SupportInner />
    </Suspense>
  );
}
