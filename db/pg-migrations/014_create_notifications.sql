-- Chunk 2.2 — booking notifications (plan.md §23, §37 "Notifications").
-- A send-log: one row per notification attempt. Like activity_logs /
-- booking_status_history it is itself an audit trail, so no §19a audit columns.
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(user_id),                 -- recipient (NULL = not a registered user)
    booking_id  UUID REFERENCES bookings(booking_id) ON DELETE SET NULL,
    channel     VARCHAR(20)  NOT NULL DEFAULT 'email',           -- 'email' now; 'whatsapp' later
    kind        VARCHAR(50)  NOT NULL,                           -- booking.confirmation | booking.cancellation | booking.status
    recipient   VARCHAR(320) NOT NULL,                           -- the email address
    subject     VARCHAR(300),
    status      VARCHAR(20)  NOT NULL DEFAULT 'sent',            -- 'sent' | 'failed'
    error       VARCHAR(500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_booking_id ON notifications (booking_id);
CREATE INDEX idx_notifications_user_id    ON notifications (user_id);
