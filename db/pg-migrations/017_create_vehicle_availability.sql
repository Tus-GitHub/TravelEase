-- Chunk 2.6 — vehicle availability (plan.md §37 "Vehicle Availability").
-- Time windows a vehicle is NOT bookable: admin blackout/maintenance, plus a
-- 'booked' row auto-written when a booking with a specific vehicle is confirmed.
CREATE TABLE vehicle_availability (
    vehicle_availability_id SERIAL PRIMARY KEY,
    vehicle_id  INT NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    kind        VARCHAR(20) NOT NULL DEFAULT 'blocked'
                CHECK (kind IN ('blocked','maintenance','booked')),
    booking_id  UUID REFERENCES bookings(booking_id) ON DELETE CASCADE,  -- set when kind='booked'
    note        VARCHAR(200),
    created_by  UUID REFERENCES users(user_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    CHECK (ends_at > starts_at)
);
CREATE INDEX idx_veh_avail_vehicle ON vehicle_availability (vehicle_id, starts_at, ends_at);
CREATE INDEX idx_veh_avail_booking ON vehicle_availability (booking_id);

CREATE TRIGGER trg_veh_avail_updated_at BEFORE UPDATE ON vehicle_availability
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
