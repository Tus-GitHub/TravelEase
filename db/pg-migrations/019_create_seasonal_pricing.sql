-- Chunk 2.8 — seasonal pricing (plan.md §37 "Seasonal Pricing"). A date-range
-- multiplier that layers on top of pricing_rules: applied to the pre-discount,
-- pre-tax subtotal for a trip whose start date falls in the window.
CREATE TABLE seasonal_pricing (
    seasonal_pricing_id SERIAL PRIMARY KEY,
    name             VARCHAR(120) NOT NULL,
    starts_on        DATE NOT NULL,
    ends_on          DATE NOT NULL,                                   -- inclusive
    booking_type_id  INT REFERENCES booking_types(booking_type_id),   -- NULL = all
    vehicle_type_id  INT REFERENCES vehicle_types(vehicle_type_id),   -- NULL = all
    multiplier       NUMERIC(4,2) NOT NULL DEFAULT 1.00,              -- 1.25 => +25%
    priority         INT NOT NULL DEFAULT 0,                          -- highest wins
    created_by  UUID REFERENCES users(user_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    CHECK (ends_on >= starts_on),
    CHECK (multiplier > 0)
);
CREATE INDEX idx_seasonal_pricing_window ON seasonal_pricing (starts_on, ends_on);

CREATE TRIGGER trg_seasonal_pricing_updated_at BEFORE UPDATE ON seasonal_pricing
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
