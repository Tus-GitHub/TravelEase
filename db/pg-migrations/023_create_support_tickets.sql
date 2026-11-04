-- Phase 3 chunk 3.2 — support tickets (plan.md §20/§38). A customer opens a
-- ticket (subject + first message), optionally tied to one of their bookings;
-- an admin replies and moves the status. Each admin reply emails the customer
-- (reuses the chunk 2.2 email infra; logged in `notifications` with
-- kind 'support.reply', booking_id NULL — that column is already nullable and
-- `kind` is free VARCHAR, so no notifications migration is needed).
CREATE TABLE support_tickets (
    support_ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference       VARCHAR(14) NOT NULL UNIQUE,          -- e.g. HELP-3F9A2C7B
    user_id         UUID NOT NULL REFERENCES users(user_id),
    booking_id      UUID REFERENCES bookings(booking_id) ON DELETE SET NULL,
    subject         VARCHAR(160) NOT NULL,
    category        VARCHAR(20) NOT NULL DEFAULT 'general'
                      CHECK (category IN ('general','booking','payment','refund','other')),
    status          VARCHAR(12) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','pending','resolved','closed')),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- bumped on each new message
    created_by  UUID REFERENCES users(user_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_support_tickets_status ON support_tickets (status, last_message_at DESC);
CREATE INDEX idx_support_tickets_user   ON support_tickets (user_id, is_deleted);

CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Append-only thread messages — no §19a set (like booking_status_history / notifications).
CREATE TABLE support_ticket_messages (
    support_ticket_message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    support_ticket_id UUID NOT NULL REFERENCES support_tickets(support_ticket_id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES users(user_id),
    author_role    VARCHAR(10) NOT NULL CHECK (author_role IN ('customer','agent','admin')),
    body           VARCHAR(4000) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_ticket_messages_ticket ON support_ticket_messages (support_ticket_id, created_at);
