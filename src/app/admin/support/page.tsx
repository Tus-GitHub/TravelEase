"use client";

import {isValidEmail,isValidPhone,normalizePhone} from "@/lib/validation";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useCallback, useEffect, useState } from "react";
import AdminActionDialog from "@/components/admin/AdminActionDialog";
import EditButton from "@/components/admin/EditButton";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";

interface Message {
  id: string;
  authorRole: "customer" | "agent" | "admin";
  authorName: string;
  body: string;
  createdAt: string;
}
interface TicketSummary {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: string;
  customerName: string;
  bookingReference: string | null;
  lastMessageAt: string;
  messageCount: number;
}
interface TicketDetail extends TicketSummary {
  customerEmail: string;
  messages: Message[];
}

const STATUSES = ["open", "pending", "resolved", "closed"] as const;
const FILTERS = ["all", ...STATUSES] as const;
const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  pending: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-surface-hover text-muted",
};
const fmt = (s: string) =>
  new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function isTripRequest(ticket:TicketSummary){return ticket.category==='booking'&&ticket.subject.startsWith('Trip request:');}
function RequestContact({ticket}:{ticket:TicketDetail}){
 if(!isTripRequest(ticket))return null;
 const body=ticket.messages.find(message=>message.authorRole==='customer')?.body??'';
 const email=/^Contact email: ([^\r\n]+)/m.exec(body)?.[1]?.trim()??'',phone=/^Phone: ([^\r\n]+)/m.exec(body)?.[1]?.trim()??'';
 return <aside aria-label="Booking request contact" className="mt-4 rounded-2xl border border-accent-500/30 bg-accent-500/5 p-4"><h3 className="font-semibold">Booking request · quote pending</h3><p className="mt-2 text-sm text-muted">Review the selected stops below and discuss the price by phone. Accommodation is arranged by the customer.</p><div className="mt-3 flex flex-wrap gap-3">{isValidPhone(phone)&&<a href={'tel:'+normalizePhone(phone)} className="inline-flex min-h-11 max-w-full items-center break-all rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold">Call {phone}</a>}{isValidEmail(email)&&<a href={'mailto:'+email} className="inline-flex min-h-11 max-w-full items-center break-all rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold">Email {email}</a>}</div></aside>;
}
export default function AdminSupportPage() {
  const { isLoading, allowed } = useAdminSectionGuard("support");

  const [editingStatus, setEditingStatus] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [onlyRequests,setOnlyRequests]=useState(false);
  useEffect(()=>{setOnlyRequests(new URLSearchParams(location.search).get('view')==='trip-requests');},[]);
  const [items, setItems] = useState<TicketSummary[]>([]);
  const visibleItems=onlyRequests?items.filter(isTripRequest):items;
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/support-tickets${q}`);
      const d = await res.json();
      setItems(res.ok ? d.items : []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetail(null);
    setErr(null);
    const res = await fetch(`/api/admin/support-tickets/${id}`);
    const d = await res.json();
    if (res.ok) setDetail(d.ticket);
  }, []);

  useEffect(() => {
    if (allowed) void loadList();
  }, [allowed, loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const patch = async (body: Record<string, unknown>) => {
    if (!selectedId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/support-tickets/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? "Something went wrong.");
        return { ok: false, error: d.error ?? "Something went wrong." };
      } else {
        setDetail(d.ticket);
        setReply("");
        void loadList();
        return { ok: true };
      }
    } catch {
      setErr("Couldn't reach the server.");
      return { ok: false, error: "Could not reach the server." };
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <AdminPageHeader className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Requests &amp; Support</h1>
        <p className="text-sm text-muted">
          {visibleItems.length} {onlyRequests?"trip requests":"tickets"}
          {filter !== "all" ? ` · ${filter}` : ""}
        </p>
      </AdminPageHeader>

      <div role="group" aria-label="Inbox type" className="mb-4 flex flex-wrap gap-2"><Button variant={onlyRequests?"outline":"primary"} onClick={()=>{setOnlyRequests(false);setSelectedId(null);setDetail(null);}}>All support</Button><Button variant={onlyRequests?"primary":"outline"} onClick={()=>{setOnlyRequests(true);setSelectedId(null);setDetail(null);}}>Trip requests</Button></div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button data-ui-action=""
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              filter === f
                ? "bg-primary-900 text-white dark:bg-primary-600"
                : "bg-surface-hover text-muted hover:text-fg"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        {/* List */}
        <Card hover={false} className="overflow-hidden">
          <ul className="divide-y divide-line-subtle">
            {loading && <li className="px-4 py-6 text-sm text-faint">Loading…</li>}
            {!loading && visibleItems.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-faint">No tickets.</li>
            )}
            {visibleItems.map((t) => (
              <li key={t.id}>
                <button data-ui-action=""
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`block w-full px-4 py-3 text-left transition-colors hover:bg-surface-hover/60 ${
                    selectedId === t.id ? "bg-surface-hover" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-fg">{t.subject}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                        STATUS_TONE[t.status] ?? ""
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-faint">
                    {t.reference} · {t.customerName}
                    {t.bookingReference ? ` · ${t.bookingReference}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Thread */}
        <Card padded hover={false}>
          {!selectedId ? (
            <p className="py-16 text-center text-sm text-faint">Select a ticket to view the conversation.</p>
          ) : !detail ? (
            <p className="py-16 text-center text-sm text-faint">Loading…</p>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-fg">{detail.subject}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    STATUS_TONE[detail.status] ?? ""
                  }`}
                >
                  {detail.status}
                </span>
              </div>
              <p className="mt-1 break-words font-mono text-xs text-faint [overflow-wrap:anywhere]">
                {detail.reference} · {detail.customerName} &lt;{detail.customerEmail}&gt;
                {detail.bookingReference ? ` · booking ${detail.bookingReference}` : ""} · {detail.category}
              </p>

              <RequestContact ticket={detail}/>
              <ul className="mt-4 space-y-3 border-t border-line pt-4">
                {detail.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`flex flex-col ${m.authorRole === "customer" ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.authorRole === "customer"
                          ? "bg-surface-hover text-fg"
                          : "bg-primary-600 text-white"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-faint">
                      {m.authorRole === "customer" ? m.authorName : `${m.authorName} (staff)`} · {fmt(m.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>

              {err && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}

              {detail.status !== "closed" && (
                <div className="mt-4">
                  <textarea
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/60"
                    rows={3}
                    maxLength={4000}
                    placeholder="Reply to the customer…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="accent"
                      size="sm"
                      loading={busy}
                      disabled={reply.trim().length < 1}
                      onClick={() => patch({ message: reply.trim() })}
                    >
                      Send reply
                    </Button>
                    <span className="text-xs text-faint">emails the customer</span>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <span className="self-center text-xs font-semibold text-muted">Ticket status</span><EditButton name={`${detail.reference} status`} disabled={busy} onClick={() => setEditingStatus(true)} />
                {editingStatus && <AdminActionDialog title={`Edit ticket ${detail.reference}`} description={detail.subject} fields={[{ name: "status", label: "Status", value: detail.status, options: STATUSES.map(value => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) })) }]} onConfirm={values => patch({ status: values.status })} onClose={() => setEditingStatus(false)} />}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
