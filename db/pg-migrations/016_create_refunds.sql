-- Chunk 2.5 — refunds (manual, plan.md §7, §37). One record per booking; the
-- amount is computed from the §7 cancellation tiers (src/lib/refund.ts) when a
-- paid booking is cancelled. Payment is offline, so an admin settles it by hand
-- (status paid | waived) and records the method/reference.
CREATE TABLE refunds (
    refund_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id     UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    amount         NUMERIC(10,2) NOT NULL,        -- owed to the customer
    charge_amount  NUMERIC(10,2) NOT NULL,        -- retained cancellation charge
    tier           VARCHAR(12) NOT NULL CHECK (tier IN ('free','half','none','operator')),
    reason         VARCHAR(500),
    status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','waived')),
    method         VARCHAR(40),                   -- e.g. 'bank transfer', 'upi'
    reference      VARCHAR(120),                  -- admin's transfer reference
    created_by     UUID REFERENCES users(user_id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by     UUID REFERENCES users(user_id),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (booking_id)
);
CREATE INDEX idx_refunds_status ON refunds (status);

CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
