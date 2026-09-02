-- Chunk 2.9 — driver details (plan.md §37 "Driver Details"). Admin roster of
-- chauffeurs; one is assigned to a booking and shown to the customer once the
-- trip is Confirmed.
CREATE TABLE drivers (
    driver_id      SERIAL PRIMARY KEY,
    name           VARCHAR(150) NOT NULL,
    phone          VARCHAR(30)  NOT NULL,
    licence_number VARCHAR(60),
    note           VARCHAR(300),
    created_by  UUID REFERENCES users(user_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true
);
CREATE TRIGGER trg_drivers_updated_at BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE bookings ADD COLUMN driver_id INT REFERENCES drivers(driver_id);
