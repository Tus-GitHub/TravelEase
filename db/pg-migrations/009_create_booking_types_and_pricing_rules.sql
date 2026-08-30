-- Chunk 1.2 (completion) — config layer for bookings.
-- booking_types: fixed lookup, seeded inline, no audit columns (same treatment as roles in 001).
-- pricing_rules: config-driven pricing (plan.md §19), gets the §19a audit set minus display_order
--                (its `priority` column already serves ordering).

CREATE TABLE booking_types (
    booking_type_id SERIAL PRIMARY KEY,
    code            VARCHAR(30)  NOT NULL UNIQUE,
    name            VARCHAR(60)  NOT NULL,
    description     VARCHAR(300)
);

INSERT INTO booking_types (booking_type_id, code, name, description) VALUES
    (1, 'point_to_point',   'Point to Point',    'Flat or per-kilometre one-way trip between two points.'),
    (2, 'hourly',           'Hourly Rental',     'Vehicle booked by the hour with an included-km allowance.'),
    (3, 'outstation',       'Outstation',        'Round trip to another city with driver allowance and night charges.'),
    (4, 'package',          'Multi-day Package', 'Multi-day itinerary, curated or customer-built.'),
    (5, 'airport_transfer', 'Airport Transfer',  'Fixed-fare pickup or drop at an airport.');

-- Keep the SERIAL sequence past the explicit ids just inserted.
SELECT setval(pg_get_serial_sequence('booking_types', 'booking_type_id'),
              (SELECT MAX(booking_type_id) FROM booking_types));

CREATE TABLE pricing_rules (
    pricing_rule_id          SERIAL PRIMARY KEY,
    booking_type_id          INT NOT NULL REFERENCES booking_types(booking_type_id),
    vehicle_type_id          INT REFERENCES vehicle_types(vehicle_type_id),  -- NULL = applies to all vehicle types
    name                     VARCHAR(150) NOT NULL,
    base_amount              NUMERIC(10,2) NOT NULL DEFAULT 0,
    per_km_rate              NUMERIC(10,2) NOT NULL DEFAULT 0,
    per_hour_rate            NUMERIC(10,2) NOT NULL DEFAULT 0,
    included_km              NUMERIC(8,2)  NOT NULL DEFAULT 0,
    extra_km_rate            NUMERIC(10,2) NOT NULL DEFAULT 0,
    per_day_rate             NUMERIC(10,2) NOT NULL DEFAULT 0,
    driver_allowance_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
    night_charge             NUMERIC(10,2) NOT NULL DEFAULT 0,
    flat_rate                NUMERIC(10,2) NOT NULL DEFAULT 0,   -- airport transfer / flat point-to-point
    tax_percent              NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- GST %, configurable per §5
    min_hours                INT,                                -- optional floor (hourly)
    min_km                   NUMERIC(8,2),                       -- optional floor
    effective_from           DATE,
    effective_to             DATE,
    priority                 INT NOT NULL DEFAULT 0,             -- higher wins when multiple rules match
    currency                 CHAR(3) NOT NULL DEFAULT 'INR',
    created_by  UUID REFERENCES users(user_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_pricing_rules_type ON pricing_rules(booking_type_id, vehicle_type_id);

CREATE TRIGGER trg_pricing_rules_updated_at BEFORE UPDATE ON pricing_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
