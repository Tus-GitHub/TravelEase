-- Chunk 1.2 (completion) — booking core. The central Bookings entity plus its child
-- tables. See plan.md §15 (bookings), §16 (stops), §17 (passengers), §18/§8 (status history), §6.
--
-- Decisions confirmed with the user before creation:
--  - booking_id is UUID (appears in URLs; §26 no-enumeration). booking_reference is the human handle.
--  - pickup_city_id is nullable (custom routes / free-text pickups may not map to a seeded city).
--  - status values are PascalCase, verbatim from the plan.md §8 state machine.
--  - booking_stops / booking_passengers get a light audit pair (created_at + created_by) only.
--  - booking_status_history is itself an audit trail -> no audit columns / triggers (cf. activity_logs).
--  - coupon_id from the §15 draft is omitted; coupons is a Phase 2 table and adds that column then.

CREATE TABLE bookings (
    booking_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference      VARCHAR(20) NOT NULL UNIQUE,          -- generated app-side (chunk 1.9)
    user_id                UUID NOT NULL REFERENCES users(user_id),
    booking_type_id        INT  NOT NULL REFERENCES booking_types(booking_type_id),
    vehicle_id             INT  REFERENCES vehicles(vehicle_id),          -- NULL until a specific vehicle is assigned
    vehicle_type_id        INT  NOT NULL REFERENCES vehicle_types(vehicle_type_id),
    package_id             INT  REFERENCES packages(package_id),          -- NULL for custom / non-package trips
    pickup_city_id         INT  REFERENCES cities(city_id),
    drop_city_id           INT  REFERENCES cities(city_id),
    pickup_address         VARCHAR(300),
    drop_address           VARCHAR(300),
    start_datetime         TIMESTAMPTZ NOT NULL,
    end_datetime           TIMESTAMPTZ,
    passenger_count        INT NOT NULL DEFAULT 1,
    estimated_distance_km  NUMERIC(8,2),
    estimated_hours        NUMERIC(6,2),
    duration_days          INT,
    status                 VARCHAR(20) NOT NULL DEFAULT 'Draft'
                            CHECK (status IN ('Draft','PendingPayment','Confirmed','Ongoing','Completed','Cancelled','Refunded')),
    price_breakdown        JSONB,                               -- §6 breakdown snapshot
    subtotal               NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount             NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency               CHAR(3) NOT NULL DEFAULT 'INR',
    assigned_agent_user_id UUID REFERENCES users(user_id),
    customer_notes         VARCHAR(1000),
    created_by  UUID REFERENCES users(user_id),                 -- who entered it (customer, or agent on behalf)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_agent   ON bookings(assigned_agent_user_id);
CREATE INDEX idx_bookings_status  ON bookings(status);
CREATE INDEX idx_bookings_type    ON bookings(booking_type_id);

CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE booking_stops (
    booking_stop_id  SERIAL PRIMARY KEY,
    booking_id       UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    tourist_spot_id  INT  REFERENCES tourist_spots(tourist_spot_id),   -- NULL for a custom location
    city_id          INT  REFERENCES cities(city_id),
    stop_order       INT  NOT NULL,                                    -- write-once snapshot, set by the booking API
    custom_label     VARCHAR(200),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID REFERENCES users(user_id)
);
CREATE INDEX idx_booking_stops_booking_id ON booking_stops(booking_id);

CREATE TABLE booking_passengers (
    booking_passenger_id  SERIAL PRIMARY KEY,
    booking_id            UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    name                  VARCHAR(200) NOT NULL,
    age                   INT,
    phone                 VARCHAR(30),
    is_primary            BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by            UUID REFERENCES users(user_id)
);
CREATE INDEX idx_booking_passengers_booking_id ON booking_passengers(booking_id);

CREATE TABLE booking_status_history (
    booking_status_history_id  BIGSERIAL PRIMARY KEY,
    booking_id          UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    from_status         VARCHAR(20),                       -- NULL for the initial Draft row
    to_status           VARCHAR(20) NOT NULL,
    changed_by_user_id  UUID REFERENCES users(user_id),    -- NULL = system-performed (§18)
    reason              VARCHAR(500),
    changed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_status_history_booking_id ON booking_status_history(booking_id);
