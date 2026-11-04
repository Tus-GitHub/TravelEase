import { randomBytes } from "crypto";
import { getPool } from "./db";
import type { PublicUser } from "./users";
import { notifySupportReply } from "./notifications";

/**
 * Support tickets (Phase 3 chunk 3.2, plan.md §20/§38). A customer opens a
 * ticket (subject + first message), optionally tied to one of their bookings.
 * An admin replies and moves the status; each admin reply emails the customer
 * (chunk 2.2 infra). IDOR: a customer only ever reaches their own tickets;
 * admins reach all. Agents are treated as plain users here (booking-scoped
 * agent access is a separate, later pass — see plan.md §9).
 */

export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketCategory = "general" | "booking" | "payment" | "refund" | "other";
export type MessageAuthorRole = "customer" | "agent" | "admin";

/** How many open/pending tickets a customer may have at once. */
export const OPEN_TICKET_LIMIT = 20;

const CATEGORIES: TicketCategory[] = ["general", "booking", "payment", "refund", "other"];
const STATUSES: TicketStatus[] = ["open", "pending", "resolved", "closed"];

export interface TicketMessageView {
  id: string;
  authorRole: MessageAuthorRole;
  authorName: string;
  body: string;
  createdAt: string;
  /** true when the viewer wrote this message. */
  mine: boolean;
}

export interface TicketSummary {
  id: string;
  reference: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  bookingId: string | null;
  bookingReference: string | null;
  customerName: string;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
}

export interface TicketDetail extends TicketSummary {
  userId: string;
  customerEmail: string;
  messages: TicketMessageView[];
}

function reference(): string {
  return `HELP-${randomBytes(5).toString("hex").toUpperCase().slice(0, 8)}`;
}

function roleOf(user: PublicUser): MessageAuthorRole {
  return user.role === "admin" ? "admin" : user.role === "agent" ? "agent" : "customer";
}

const SUMMARY_SELECT = `
  SELECT st.support_ticket_id, st.reference, st.subject, st.category, st.status,
         st.booking_id, b.booking_reference, u.name AS customer_name,
         st.last_message_at, st.created_at,
         (SELECT count(*)::int FROM support_ticket_messages m
           WHERE m.support_ticket_id = st.support_ticket_id) AS message_count
    FROM support_tickets st
    JOIN users u ON u.user_id = st.user_id
    LEFT JOIN bookings b ON b.booking_id = st.booking_id
`;

function toSummary(r: Record<string, unknown>): TicketSummary {
  return {
    id: r.support_ticket_id as string,
    reference: r.reference as string,
    subject: r.subject as string,
    category: r.category as TicketCategory,
    status: r.status as TicketStatus,
    bookingId: (r.booking_id as string) ?? null,
    bookingReference: (r.booking_reference as string) ?? null,
    customerName: r.customer_name as string,
    lastMessageAt: new Date(r.last_message_at as string).toISOString(),
    createdAt: new Date(r.created_at as string).toISOString(),
    messageCount: Number(r.message_count),
  };
}

async function getTicketDetail(
  ticketId: string,
  viewer: PublicUser,
): Promise<TicketDetail | null> {
  const pool = getPool();
  const t = (
    await pool.query(
      `SELECT st.support_ticket_id, st.reference, st.subject, st.category, st.status,
              st.booking_id, b.booking_reference, u.name AS customer_name, u.email AS customer_email,
              st.last_message_at, st.created_at, st.user_id
         FROM support_tickets st
         JOIN users u ON u.user_id = st.user_id
         LEFT JOIN bookings b ON b.booking_id = st.booking_id
        WHERE st.support_ticket_id = $1 AND st.is_deleted = false`,
      [ticketId],
    )
  ).rows[0];
  if (!t) return null;
  if (viewer.role !== "admin" && t.user_id !== viewer.id) return null;

  const msgs = (
    await pool.query(
      `SELECT m.support_ticket_message_id, m.author_user_id, m.author_role, m.body, m.created_at,
              u.name AS author_name
         FROM support_ticket_messages m
         JOIN users u ON u.user_id = m.author_user_id
        WHERE m.support_ticket_id = $1
        ORDER BY m.created_at, m.support_ticket_message_id`,
      [ticketId],
    )
  ).rows;

  return {
    id: t.support_ticket_id,
    reference: t.reference,
    subject: t.subject,
    category: t.category,
    status: t.status,
    bookingId: t.booking_id ?? null,
    bookingReference: t.booking_reference ?? null,
    customerName: t.customer_name,
    lastMessageAt: new Date(t.last_message_at).toISOString(),
    createdAt: new Date(t.created_at).toISOString(),
    messageCount: msgs.length,
    userId: t.user_id,
    customerEmail: t.customer_email,
    messages: msgs.map((m) => ({
      id: m.support_ticket_message_id,
      authorRole: m.author_role as MessageAuthorRole,
      authorName: m.author_name,
      body: m.body,
      createdAt: new Date(m.created_at).toISOString(),
      mine: m.author_user_id === viewer.id,
    })),
  };
}

// ─── Customer ──────────────────────────────────────────────────────────────

export async function listTicketsForUser(userId: string): Promise<TicketSummary[]> {
  const r = await getPool().query(
    `${SUMMARY_SELECT} WHERE st.user_id = $1 AND st.is_deleted = false
      ORDER BY st.last_message_at DESC`,
    [userId],
  );
  return r.rows.map(toSummary);
}

export function getTicketForUser(
  ticketId: string,
  viewer: PublicUser,
): Promise<TicketDetail | null> {
  return getTicketDetail(ticketId, viewer);
}

export type CreateTicketResult =
  | { ok: true; ticket: TicketDetail }
  | { ok: false; status: number; message: string };

export async function createTicket(
  user: PublicUser,
  input: { subject: string; category?: string; bookingId?: string | null; message: string },
): Promise<CreateTicketResult> {
  const subject = (input.subject ?? "").trim().slice(0, 160);
  const body = (input.message ?? "").trim().slice(0, 4000);
  if (subject.length < 3) return { ok: false, status: 400, message: "Add a short subject." };
  if (body.length < 3) {
    return { ok: false, status: 400, message: "Add a message describing the issue." };
  }
  const category: TicketCategory = CATEGORIES.includes(input.category as TicketCategory)
    ? (input.category as TicketCategory)
    : "general";

  const pool = getPool();

  const openCount = (
    await pool.query(
      `SELECT count(*)::int AS n FROM support_tickets
        WHERE user_id = $1 AND is_deleted = false AND status IN ('open','pending')`,
      [user.id],
    )
  ).rows[0].n as number;
  if (openCount >= OPEN_TICKET_LIMIT) {
    return {
      ok: false,
      status: 409,
      message: `You already have ${OPEN_TICKET_LIMIT} tickets open. Please wait for a reply before opening another.`,
    };
  }

  let bookingId: string | null = null;
  if (typeof input.bookingId === "string" && input.bookingId) {
    const b = await pool.query(
      `SELECT 1 FROM bookings WHERE booking_id = $1 AND user_id = $2 AND is_deleted = false`,
      [input.bookingId, user.id],
    );
    if (!b.rowCount) {
      return { ok: false, status: 400, message: "That booking isn't one of yours." };
    }
    bookingId = input.bookingId;
  }

  const client = await pool.connect();
  let ticketId: string | null = null;
  try {
    await client.query("BEGIN");
    for (let attempt = 0; attempt < 5 && !ticketId; attempt++) {
      try {
        const res = await client.query(
          `INSERT INTO support_tickets
             (reference, user_id, booking_id, subject, category, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $6)
           RETURNING support_ticket_id`,
          [reference(), user.id, bookingId, subject, category, user.id],
        );
        ticketId = res.rows[0].support_ticket_id;
      } catch (err) {
        if ((err as { code?: string }).code === "23505") continue; // reference clash — retry
        throw err;
      }
    }
    if (!ticketId) throw new Error("could not allocate a ticket reference");
    await client.query(
      `INSERT INTO support_ticket_messages (support_ticket_id, author_user_id, author_role, body)
       VALUES ($1, $2, $3, $4)`,
      [ticketId, user.id, roleOf(user), body],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { ok: true, ticket: (await getTicketDetail(ticketId, user))! };
}

export type AddMessageResult =
  | { ok: true; ticket: TicketDetail }
  | { ok: false; status: number; message: string };

/** Append a message. Customer reply -> back to `open`; staff reply -> `pending`
 *  + a non-blocking email to the customer. */
export async function addTicketMessage(
  ticketId: string,
  viewer: PublicUser,
  bodyRaw: string,
): Promise<AddMessageResult> {
  const body = (bodyRaw ?? "").trim().slice(0, 4000);
  if (body.length < 1) return { ok: false, status: 400, message: "Type a message." };

  const pool = getPool();
  const t = (
    await pool.query(
      `SELECT user_id, status FROM support_tickets
        WHERE support_ticket_id = $1 AND is_deleted = false`,
      [ticketId],
    )
  ).rows[0];
  if (!t) return { ok: false, status: 404, message: "Ticket not found." };
  if (viewer.role !== "admin" && t.user_id !== viewer.id) {
    return { ok: false, status: 404, message: "Ticket not found." };
  }
  if (t.status === "closed") {
    return { ok: false, status: 409, message: "This ticket is closed. Open a new one." };
  }

  const authorRole = roleOf(viewer);
  const nextStatus: TicketStatus = authorRole === "customer" ? "open" : "pending";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO support_ticket_messages (support_ticket_id, author_user_id, author_role, body)
       VALUES ($1, $2, $3, $4)`,
      [ticketId, viewer.id, authorRole, body],
    );
    await client.query(
      `UPDATE support_tickets SET status = $2, last_message_at = now(), updated_by = $3
        WHERE support_ticket_id = $1`,
      [ticketId, nextStatus, viewer.id],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (authorRole !== "customer") {
    await notifySupportReply(ticketId); // non-blocking, never throws
  }
  return { ok: true, ticket: (await getTicketDetail(ticketId, viewer))! };
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export async function listAllTickets(status?: string): Promise<TicketSummary[]> {
  const valid = STATUSES.includes(status as TicketStatus) ? (status as TicketStatus) : null;
  const r = await getPool().query(
    `${SUMMARY_SELECT}
      WHERE st.is_deleted = false ${valid ? "AND st.status = $1" : ""}
      ORDER BY st.last_message_at DESC`,
    valid ? [valid] : [],
  );
  return r.rows.map(toSummary);
}

export function getTicketAdmin(
  ticketId: string,
  admin: PublicUser,
): Promise<TicketDetail | null> {
  return getTicketDetail(ticketId, admin);
}

export async function setTicketStatus(
  ticketId: string,
  status: string,
  actorId: string,
): Promise<boolean> {
  if (!STATUSES.includes(status as TicketStatus)) return false;
  const r = await getPool().query(
    `UPDATE support_tickets SET status = $2, updated_by = $3
      WHERE support_ticket_id = $1 AND is_deleted = false`,
    [ticketId, status, actorId],
  );
  return (r.rowCount ?? 0) > 0;
}
