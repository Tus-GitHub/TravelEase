-- Approved Phase 3.6 schema. Apply to development only until production approval.
INSERT INTO roles (role_id, name) VALUES (4, 'driver');
SELECT setval(pg_get_serial_sequence('roles','role_id'), (SELECT max(role_id) FROM roles), true);
ALTER TABLE drivers ADD COLUMN user_id UUID UNIQUE REFERENCES users(user_id) ON DELETE SET NULL;
CREATE TABLE driver_locations (
  location_id BIGSERIAL PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  driver_id INT NOT NULL REFERENCES drivers(driver_id),
  lat NUMERIC(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng NUMERIC(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy NUMERIC(8,2) CHECK (accuracy >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_driver_locations_booking ON driver_locations (booking_id, recorded_at DESC);
