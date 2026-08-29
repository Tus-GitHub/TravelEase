-- Generic trigger function: maintains a dense, gap-free ordering column.
-- Args: (order_col, scope_col) — scope_col = '' means "global" (whole table, no partition).
-- INSERT: assigns next value = MAX(order_col) + 1 within scope (active rows only).
-- DELETE, or UPDATE where is_deleted goes false->true: shifts everyone after it down by 1.
CREATE OR REPLACE FUNCTION maintain_display_order()
RETURNS TRIGGER AS $$
DECLARE
  order_col TEXT := TG_ARGV[0];
  scope_col TEXT := NULLIF(TG_ARGV[1], '');
  scope_val TEXT;
  next_order INT;
  cur_order INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF scope_col IS NULL THEN
      EXECUTE format('SELECT COALESCE(MAX(%I),0)+1 FROM %I WHERE is_deleted = false', order_col, TG_TABLE_NAME)
        INTO next_order;
    ELSE
      scope_val := row_to_json(NEW)::jsonb ->> scope_col;
      EXECUTE format('SELECT COALESCE(MAX(%I),0)+1 FROM %I WHERE is_deleted = false AND %I::text = $1', order_col, TG_TABLE_NAME, scope_col)
        USING scope_val INTO next_order;
    END IF;
    NEW := jsonb_populate_record(NEW, jsonb_build_object(order_col, next_order));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    cur_order := (row_to_json(OLD)::jsonb ->> order_col)::int;
    IF scope_col IS NULL THEN
      EXECUTE format('UPDATE %I SET %I = %I - 1 WHERE %I > $1', TG_TABLE_NAME, order_col, order_col, order_col)
        USING cur_order;
    ELSE
      scope_val := row_to_json(OLD)::jsonb ->> scope_col;
      EXECUTE format('UPDATE %I SET %I = %I - 1 WHERE %I::text = $1 AND %I > $2', TG_TABLE_NAME, order_col, order_col, scope_col, order_col)
        USING scope_val, cur_order;
    END IF;
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF (row_to_json(NEW)::jsonb ->> 'is_deleted')::boolean = true
       AND (row_to_json(OLD)::jsonb ->> 'is_deleted')::boolean = false THEN
      cur_order := (row_to_json(OLD)::jsonb ->> order_col)::int;
      IF scope_col IS NULL THEN
        EXECUTE format('UPDATE %I SET %I = %I - 1 WHERE %I > $1 AND is_deleted = false', TG_TABLE_NAME, order_col, order_col, order_col)
          USING cur_order;
      ELSE
        scope_val := row_to_json(OLD)::jsonb ->> scope_col;
        EXECUTE format('UPDATE %I SET %I = %I - 1 WHERE %I::text = $1 AND %I > $2 AND is_deleted = false', TG_TABLE_NAME, order_col, order_col, scope_col, order_col)
          USING scope_val, cur_order;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- users: global
CREATE TRIGGER trg_users_order_ins BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', '');
CREATE TRIGGER trg_users_order_upd_del AFTER UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', '');

-- vehicle_types: global
CREATE TRIGGER trg_vehicle_types_order_ins BEFORE INSERT ON vehicle_types
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', '');
CREATE TRIGGER trg_vehicle_types_order_upd_del AFTER UPDATE OR DELETE ON vehicle_types
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', '');

-- vehicles: scoped per vehicle_type
CREATE TRIGGER trg_vehicles_order_ins BEFORE INSERT ON vehicles
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', 'vehicle_type_id');
CREATE TRIGGER trg_vehicles_order_upd_del AFTER UPDATE OR DELETE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', 'vehicle_type_id');

-- vehicle_images: scoped per vehicle
CREATE TRIGGER trg_vehicle_images_order_ins BEFORE INSERT ON vehicle_images
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', 'vehicle_id');
CREATE TRIGGER trg_vehicle_images_order_upd_del AFTER UPDATE OR DELETE ON vehicle_images
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', 'vehicle_id');

-- regions: global
CREATE TRIGGER trg_regions_order_ins BEFORE INSERT ON regions
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', '');
CREATE TRIGGER trg_regions_order_upd_del AFTER UPDATE OR DELETE ON regions
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', '');

-- cities: scoped per region
CREATE TRIGGER trg_cities_order_ins BEFORE INSERT ON cities
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', 'region_id');
CREATE TRIGGER trg_cities_order_upd_del AFTER UPDATE OR DELETE ON cities
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', 'region_id');

-- tourist_spots: scoped per city
CREATE TRIGGER trg_tourist_spots_order_ins BEFORE INSERT ON tourist_spots
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', 'city_id');
CREATE TRIGGER trg_tourist_spots_order_upd_del AFTER UPDATE OR DELETE ON tourist_spots
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', 'city_id');

-- packages: scoped per region
CREATE TRIGGER trg_packages_order_ins BEFORE INSERT ON packages
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', 'region_id');
CREATE TRIGGER trg_packages_order_upd_del AFTER UPDATE OR DELETE ON packages
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', 'region_id');

-- package_stops: uses its existing stop_order column, scoped per package
CREATE TRIGGER trg_package_stops_order_ins BEFORE INSERT ON package_stops
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('stop_order', 'package_id');
CREATE TRIGGER trg_package_stops_order_upd_del AFTER UPDATE OR DELETE ON package_stops
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('stop_order', 'package_id');

-- customer_profiles: global (at most 1 row per user anyway, but kept consistent)
CREATE TRIGGER trg_customer_profiles_order_ins BEFORE INSERT ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', '');
CREATE TRIGGER trg_customer_profiles_order_upd_del AFTER UPDATE OR DELETE ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order', '');

-- Backfill: users is the only table with existing data right now (all others are empty).
WITH ranked AS (
  SELECT user_id, ROW_NUMBER() OVER (ORDER BY created_at, user_id) AS rn
  FROM users WHERE is_deleted = false
)
UPDATE users u SET display_order = ranked.rn
FROM ranked WHERE u.user_id = ranked.user_id;
