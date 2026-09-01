-- Chunk 2.3 — coupons (plan.md §37 "Coupons", §31). `coupons` gets the §19a
-- audit set minus display_order (order is meaningless for codes). Redemptions
-- are their own table so usage limits can be counted.
CREATE TABLE coupons (
    coupon_id          SERIAL PRIMARY KEY,
    code               VARCHAR(40)   NOT NULL UNIQUE,       -- stored uppercase; matched case-insensitively
    description        VARCHAR(200),
    discount_type      VARCHAR(10)   NOT NULL CHECK (discount_type IN ('percent','flat')),
    discount_value     NUMERIC(10,2) NOT NULL,              -- 15 => 15%  |  500 => ₹500
    max_discount       NUMERIC(10,2),                       -- cap for percent coupons; NULL = uncapped
    min_booking_amount NUMERIC(10,2) NOT NULL DEFAULT 0,    -- subtotal must be >= this
    usage_limit        INT,                                 -- total redemptions allowed; NULL = unlimited
    per_user_limit     INT NOT NULL DEFAULT 1,
    starts_at          TIMESTAMPTZ,
    expires_at         TIMESTAMPTZ,
    created_by  UUID REFERENCES users(user_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true
);
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE coupon_redemptions (
    coupon_redemption_id SERIAL PRIMARY KEY,
    coupon_id   INT  NOT NULL REFERENCES coupons(coupon_id),
    booking_id  UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(user_id),
    amount      NUMERIC(10,2) NOT NULL,                     -- discount actually applied
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coupon_id, booking_id)
);
CREATE INDEX idx_coupon_redemptions_coupon ON coupon_redemptions (coupon_id);
CREATE INDEX idx_coupon_redemptions_user   ON coupon_redemptions (user_id);

ALTER TABLE bookings ADD COLUMN coupon_id INT REFERENCES coupons(coupon_id);
