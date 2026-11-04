"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Section from "@/components/common/Section";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import Skeleton from "@/components/common/Skeleton";
import { useAuth } from "@/context/AuthContext";

interface Message {
  id: string;
  authorRole: "customer" | "agent" | "admin";
  authorName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}
interface Ticket {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: string;
  bookingId: string | null;
  bookingReference: string | null;
  createdAt: string;
  messages: Message[];
}

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  pending: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-surface-hover text-muted",
};
const fmt = (s: string) =>
  new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function SupportThreadPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?redirect=/profile/support/${id}`);
  }, [isLoading, user, router, id]);

  const load = useCallback(() => {
    if (!user || !id) return;
    setState("loading");
    fetch(`/api/support-tickets/${id}`)
      .then(async (r) => {
        if (r.status === 404) return setState("notfound");
        if (!r.ok) return setState("error");
        const d = await r.json();
        setTicket(d.ticket);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [user, id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (reply.trim().length < 1) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/support-tickets/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? "Couldn't send your reply.");
      } else {
        setTicket(d.ticket);
        setReply("");
      }
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section bg="gray">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/profile/support"
          className="hover-underline mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-300"
        >
          <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
          All tickets
        </Link>

        {isLoading || !user || state === "loading" ? (
          <Skeleton className="h-80 w-full" />
        ) : state === "notfound" ? (
          <Card padded hover={false} className="text-center">
            <h1 className="font-display text-xl font-bold text-fg">Ticket not found</h1>
            <p className="mt-2 text-sm text-muted">It may have been removed, or this isn&apos;t your ticket.</p>
            <div className="mt-4">
              <Button href="/profile/support" variant="accent" size="sm">
                Back to support
              </Button>
            </div>
          </Card>
        ) : state === "error" ? (
          <Card padded hover={false} className="text-center">
            <p className="text-sm text-muted">Couldn&apos;t load this ticket.</p>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={load}>
                Retry
              </Button>
            </div>
          </Card>
        ) : ticket ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold text-fg">{ticket.subject}</h1>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                  STATUS_TONE[ticket.status] ?? ""
                }`}
              >
                {ticket.status}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-faint">
              {ticket.reference}
              {ticket.bookingReference && (
                <>
                  {" · "}
                  <Link
                    href={`/profile/bookings/${ticket.bookingId}`}
                    className="hover-underline"
                  >
                    booking {ticket.bookingReference}
                  </Link>
                </>
              )}
              {` · opened ${fmt(ticket.createdAt)}`}
            </p>

            <Card padded hover={false} className="mt-5">
              <ul className="space-y-4">
                {ticket.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.mine
                          ? "bg-primary-600 text-white"
                          : "bg-surface-hover text-fg"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-faint">
                      {m.authorRole === "customer" ? m.authorName : "Support"} · {fmt(m.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>

            {ticket.status === "closed" ? (
              <p className="mt-5 text-sm text-muted">
                This ticket is closed.{" "}
                <Link href="/profile/support" className="hover-underline text-primary-700 dark:text-primary-300">
                  Open a new one
                </Link>{" "}
                if you still need help.
              </p>
            ) : (
              <div className="mt-5">
                <textarea
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/60"
                  rows={3}
                  maxLength={4000}
                  placeholder="Write a reply…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                {err && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{err}</p>}
                <div className="mt-2">
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={send}
                    loading={busy}
                    disabled={reply.trim().length < 1}
                  >
                    Send reply
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Section>
  );
}
