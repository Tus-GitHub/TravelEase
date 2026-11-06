-- Names/types approved 2026-11-06 for DEVELOPMENT only; see WEEKEND_TRIPS_PLAN.md.
-- Production application requires a separate authorized release.
CREATE TABLE tour_guides (
  guide_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL CHECK (length(trim(name)) > 0),
  phone VARCHAR(30) NOT NULL,
  image_url VARCHAR(500),
  bio TEXT NOT NULL DEFAULT '',
  languages JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(languages)='array'),
  private_notes VARCHAR(1000),
  created_by UUID REFERENCES users(user_id), updated_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false, is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TRIGGER trg_tour_guides_updated_at BEFORE UPDATE ON tour_guides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE trip_departures (
  departure_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id INT NOT NULL REFERENCES packages(package_id),
  slug VARCHAR(160) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  pickup_city_id INT NOT NULL REFERENCES cities(city_id),
  pickup_address VARCHAR(300) NOT NULL, return_address VARCHAR(300) NOT NULL,
  vehicle_id INT REFERENCES vehicles(vehicle_id), driver_id INT REFERENCES drivers(driver_id),
  guide_id INT REFERENCES tour_guides(guide_id),
  capacity INT NOT NULL CHECK (capacity BETWEEN 1 AND 1000),
  staff_reserved_seats INT NOT NULL DEFAULT 0 CHECK (staff_reserved_seats >= 0),
  min_travellers INT NOT NULL DEFAULT 1 CHECK (min_travellers >= 1 AND min_travellers <= capacity),
  price_per_person NUMERIC(10,2) NOT NULL CHECK (price_per_person > 0),
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_percent BETWEEN 0 AND 100),
  booking_opens_at TIMESTAMPTZ NOT NULL, booking_closes_at TIMESTAMPTZ NOT NULL,
  decision_deadline TIMESTAMPTZ NOT NULL,
  payment_hold_minutes INT NOT NULL DEFAULT 120 CHECK (payment_hold_minutes BETWEEN 5 AND 1440),
  status VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','open','guaranteed','closed','ongoing','completed','cancelled')),
  content JSONB NOT NULL CHECK (jsonb_typeof(content)='object'),
  private_notes VARCHAR(2000), version INT NOT NULL DEFAULT 1 CHECK (version > 0),
  is_featured BOOLEAN NOT NULL DEFAULT false, display_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(user_id), updated_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false, is_active BOOLEAN NOT NULL DEFAULT true,
  CHECK (ends_at > starts_at),
  CHECK (booking_opens_at < booking_closes_at AND booking_closes_at < starts_at),
  CHECK (decision_deadline > booking_opens_at AND decision_deadline <= booking_closes_at)
);
CREATE TRIGGER trg_trip_departures_updated_at BEFORE UPDATE ON trip_departures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_trip_departures_public ON trip_departures(starts_at, status) WHERE NOT is_deleted AND is_active;

CREATE TABLE trip_stays (
  stay_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  departure_id UUID NOT NULL REFERENCES trip_departures(departure_id),
  hotel_name VARCHAR(200) NOT NULL, hotel_address VARCHAR(500) NOT NULL,
  city_id INT REFERENCES cities(city_id), image_url VARCHAR(500),
  check_in DATE NOT NULL, check_out DATE NOT NULL CHECK (check_out > check_in),
  room_type VARCHAR(120) NOT NULL, rooms_reserved INT NOT NULL DEFAULT 0 CHECK (rooms_reserved >= 0),
  occupancy_per_room INT NOT NULL CHECK (occupancy_per_room BETWEEN 1 AND 20),
  staff_beds_reserved INT NOT NULL DEFAULT 0 CHECK (staff_beds_reserved >= 0),
  meal_plan VARCHAR(200) NOT NULL DEFAULT '',
  confirmation_status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (confirmation_status IN ('pending','confirmed','cancelled')),
  supplier_reference VARCHAR(120), contact_name VARCHAR(150), contact_phone VARCHAR(30),
  supplier_cost NUMERIC(12,2) CHECK (supplier_cost >= 0),
  public_notes VARCHAR(1000), private_notes VARCHAR(2000),
  created_by UUID REFERENCES users(user_id), updated_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false, is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TRIGGER trg_trip_stays_updated_at BEFORE UPDATE ON trip_stays
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_trip_stays_departure ON trip_stays(departure_id);

CREATE TABLE trip_room_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id UUID NOT NULL REFERENCES trip_stays(stay_id),
  booking_passenger_id INT NOT NULL REFERENCES booking_passengers(booking_passenger_id),
  room_label VARCHAR(60) NOT NULL CHECK (length(trim(room_label)) > 0),
  private_notes VARCHAR(500),
  created_by UUID REFERENCES users(user_id), updated_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false, is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TRIGGER trg_trip_room_assignments_updated_at BEFORE UPDATE ON trip_room_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE UNIQUE INDEX idx_trip_room_assignments_passenger ON trip_room_assignments(stay_id,booking_passenger_id)
  WHERE NOT is_deleted AND is_active;

ALTER TABLE packages ADD COLUMN booking_mode VARCHAR(16) NOT NULL DEFAULT 'private'
  CONSTRAINT weekend_package_mode CHECK (booking_mode IN ('private','shared','both'));
ALTER TABLE bookings ADD COLUMN departure_id UUID
  CONSTRAINT weekend_booking_departure_fk REFERENCES trip_departures(departure_id);
ALTER TABLE bookings ADD COLUMN seat_hold_expires_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN client_request_id UUID;
ALTER TABLE bookings ADD COLUMN trip_snapshot JSONB
  CONSTRAINT weekend_booking_snapshot CHECK (trip_snapshot IS NULL OR jsonb_typeof(trip_snapshot)='object');
CREATE INDEX idx_weekend_bookings_departure ON bookings(departure_id,status);
CREATE UNIQUE INDEX idx_weekend_bookings_request ON bookings(user_id,client_request_id) WHERE client_request_id IS NOT NULL;
ALTER TABLE vehicle_availability ADD COLUMN departure_id UUID
  CONSTRAINT weekend_availability_departure_fk REFERENCES trip_departures(departure_id);
ALTER TABLE vehicle_availability ADD CONSTRAINT weekend_availability_owner
  CHECK (booking_id IS NULL OR departure_id IS NULL);
CREATE UNIQUE INDEX idx_weekend_availability_departure ON vehicle_availability(departure_id)
  WHERE departure_id IS NOT NULL AND NOT is_deleted;
