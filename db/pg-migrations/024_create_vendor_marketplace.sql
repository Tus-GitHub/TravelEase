-- Phase 3 chunk 3.5 — vendor marketplace (plan.md §20/§38; reverses the §4
-- "owned fleet only" lock). Admin-managed, no vendor login. A vehicle can be
-- owned by a vendor; when a vendor's vehicle runs a Completed trip, Jagdamba
-- owes the vendor (trip total − commission). Commission is one global % stored
-- in site_settings (key 'vendor_commission_pct'); an admin generates monthly
-- payout statements and settles them like refunds.
CREATE TABLE vendor_profiles (
    vendor_profile_id SERIAL PRIMARY KEY,
    business_name   VARCHAR(160) NOT NULL,
    contact_name    VARCHAR(120),
    contact_email   VARCHAR(320),
    contact_phone   VARCHAR(30),
    address         VARCHAR(300),
    payout_details  VARCHAR(400),
    status          VARCHAR(12) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','suspended')),
    notes           VARCHAR(500),
    created_by  UUID REFERENCES users(user_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);
CREATE TRIGGER trg_vendor_profiles_updated_at BEFORE UPDATE ON vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE vehicles
  ADD COLUMN vendor_profile_id INT REFERENCES vendor_profiles(vendor_profile_id) ON DELETE SET NULL;

CREATE TABLE payouts (
    payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id INT NOT NULL REFERENCES vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
    period_start      DATE NOT NULL,               -- inclusive
    period_end        DATE NOT NULL,               -- exclusive (first day of next month)
    booking_count     INT NOT NULL DEFAULT 0,
    gross_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    commission_pct    NUMERIC(5,2)  NOT NULL,
    commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    status            VARCHAR(10) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','void')),
    method            VARCHAR(40),
    reference         VARCHAR(120),
    notes             VARCHAR(500),
    created_by  UUID REFERENCES users(user_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (vendor_profile_id, period_start, period_end)
);
CREATE INDEX idx_payouts_status ON payouts (status);

CREATE TRIGGER trg_payouts_updated_at BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
