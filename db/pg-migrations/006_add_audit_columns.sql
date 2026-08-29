CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users
ALTER TABLE users
  ADD COLUMN created_by    UUID REFERENCES users(user_id),
  ADD COLUMN updated_by    UUID REFERENCES users(user_id),
  ADD COLUMN updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN display_order INT NOT NULL DEFAULT 0,
  ADD COLUMN is_deleted    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_active     BOOLEAN NOT NULL DEFAULT true;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- vehicle_types
ALTER TABLE vehicle_types
  ADD COLUMN created_by UUID REFERENCES users(user_id),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES users(user_id),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;
CREATE TRIGGER trg_vehicle_types_updated_at BEFORE UPDATE ON vehicle_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- vehicles
ALTER TABLE vehicles
  ADD COLUMN created_by    UUID REFERENCES users(user_id),
  ADD COLUMN updated_by    UUID REFERENCES users(user_id),
  ADD COLUMN updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN display_order INT NOT NULL DEFAULT 0,
  ADD COLUMN is_deleted    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_active     BOOLEAN NOT NULL DEFAULT true;
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- vehicle_images
ALTER TABLE vehicle_images
  ADD COLUMN created_by UUID REFERENCES users(user_id),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES users(user_id),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_active  BOOLEAN NOT NULL DEFAULT true;
CREATE TRIGGER trg_vehicle_images_updated_at BEFORE UPDATE ON vehicle_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- regions
ALTER TABLE regions
  ADD COLUMN created_by    UUID REFERENCES users(user_id),
  ADD COLUMN created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by    UUID REFERENCES users(user_id),
  ADD COLUMN updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN display_order INT NOT NULL DEFAULT 0,
  ADD COLUMN is_deleted    BOOLEAN NOT NULL DEFAULT false;
CREATE TRIGGER trg_regions_updated_at BEFORE UPDATE ON regions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- cities
ALTER TABLE cities
  ADD COLUMN created_by    UUID REFERENCES users(user_id),
  ADD COLUMN created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by    UUID REFERENCES users(user_id),
  ADD COLUMN updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN display_order INT NOT NULL DEFAULT 0,
  ADD COLUMN is_deleted    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_active     BOOLEAN NOT NULL DEFAULT true;
CREATE TRIGGER trg_cities_updated_at BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- tourist_spots
ALTER TABLE tourist_spots
  ADD COLUMN created_by UUID REFERENCES users(user_id),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES users(user_id),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_active  BOOLEAN NOT NULL DEFAULT true;
CREATE TRIGGER trg_tourist_spots_updated_at BEFORE UPDATE ON tourist_spots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- packages
ALTER TABLE packages
  ADD COLUMN created_by    UUID REFERENCES users(user_id),
  ADD COLUMN created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by    UUID REFERENCES users(user_id),
  ADD COLUMN updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN display_order INT NOT NULL DEFAULT 0,
  ADD COLUMN is_deleted    BOOLEAN NOT NULL DEFAULT false;
CREATE TRIGGER trg_packages_updated_at BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- package_stops (no display_order — stop_order already serves that purpose)
ALTER TABLE package_stops
  ADD COLUMN created_by UUID REFERENCES users(user_id),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES users(user_id),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_active  BOOLEAN NOT NULL DEFAULT true;
CREATE TRIGGER trg_package_stops_updated_at BEFORE UPDATE ON package_stops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- customer_profiles
ALTER TABLE customer_profiles
  ADD COLUMN created_by    UUID REFERENCES users(user_id),
  ADD COLUMN updated_by    UUID REFERENCES users(user_id),
  ADD COLUMN display_order INT NOT NULL DEFAULT 0,
  ADD COLUMN is_deleted    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_active     BOOLEAN NOT NULL DEFAULT true;
CREATE TRIGGER trg_customer_profiles_updated_at BEFORE UPDATE ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
