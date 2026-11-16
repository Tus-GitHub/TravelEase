-- Approved 16 November 2026: Region -> State -> City -> Tourist spot.
-- Keep legacy region/state text and city/region IDs for safe rolling deployment;
-- the State FK is authoritative and its region is derived, never a second choice.
CREATE FUNCTION geography_name_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT lower(btrim(regexp_replace(value, '[[:space:]]+', ' ', 'g'))) $$;

CREATE TABLE states (
  state_id SERIAL PRIMARY KEY,
  region_id INTEGER NOT NULL REFERENCES regions(region_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL CHECK (length(geography_name_key(name)) >= 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NULL REFERENCES users(user_id),
  updated_by UUID NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_states_parent_name ON states(region_id, geography_name_key(name)) WHERE NOT is_deleted;
CREATE INDEX idx_states_region ON states(region_id);
CREATE TRIGGER trg_states_updated_at BEFORE UPDATE ON states FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_states_order_ins BEFORE INSERT ON states FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order','region_id');
CREATE TRIGGER trg_states_order_upd_del AFTER UPDATE OR DELETE ON states FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order','region_id');

-- Preserve every existing row and reference. An ambiguous/empty legacy value
-- fails the deployment transaction instead of inventing or deleting geography.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM regions WHERE length(geography_name_key(state)) < 2) THEN
    RAISE EXCEPTION 'Give every legacy region a valid state before migration033';
  END IF;
END $$;
INSERT INTO states(region_id,name,is_active,is_deleted,created_by,updated_by,created_at,updated_at)
SELECT region_id,btrim(regexp_replace(state,'[[:space:]]+',' ','g')),is_active,is_deleted,created_by,updated_by,created_at,updated_at FROM regions;
ALTER TABLE cities ADD COLUMN state_id INTEGER REFERENCES states(state_id);
UPDATE cities c SET state_id=s.state_id FROM states s WHERE s.region_id=c.region_id;
ALTER TABLE cities ALTER COLUMN state_id SET NOT NULL;
CREATE INDEX idx_cities_state ON cities(state_id);
DROP TRIGGER trg_cities_order_ins ON cities;
DROP TRIGGER trg_cities_order_upd_del ON cities;
CREATE TRIGGER trg_cities_order_ins BEFORE INSERT ON cities FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order','state_id');
CREATE TRIGGER trg_cities_order_upd_del AFTER UPDATE OR DELETE ON cities FOR EACH ROW EXECUTE FUNCTION maintain_display_order('display_order','state_id');
CREATE UNIQUE INDEX uq_regions_name ON regions(geography_name_key(name)) WHERE NOT is_deleted;
CREATE UNIQUE INDEX uq_cities_parent_name ON cities(state_id,geography_name_key(name)) WHERE NOT is_deleted;
CREATE UNIQUE INDEX uq_spots_parent_name ON tourist_spots(city_id,geography_name_key(name)) WHERE NOT is_deleted;
ALTER TABLE regions ALTER COLUMN state SET DEFAULT '';
COMMENT ON COLUMN regions.state IS 'Legacy compatibility only. Manage states in the states master.';
COMMENT ON COLUMN cities.region_id IS 'Derived from states.region_id by trigger; new editors select state_id.';

-- Support the previous released client and native fixture writers only when its
-- region identifies exactly one state. Never pick arbitrarily in a multi-state region.
CREATE FUNCTION legacy_region_state_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF length(geography_name_key(NEW.state)) >= 2 THEN
    INSERT INTO states(region_id,name,is_active,is_deleted,created_by,updated_by)
    VALUES(NEW.region_id,btrim(NEW.state),NEW.is_active,NEW.is_deleted,NEW.created_by,NEW.updated_by);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_regions_legacy_state AFTER INSERT ON regions FOR EACH ROW EXECUTE FUNCTION legacy_region_state_insert();

CREATE FUNCTION derive_city_region() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_region integer; candidates integer; legacy_move boolean := false;
BEGIN
  IF NEW.state_id IS NOT NULL THEN SELECT region_id INTO parent_region FROM states WHERE state_id=NEW.state_id; END IF;
  IF TG_OP='UPDATE' THEN
    legacy_move := NEW.state_id IS NOT DISTINCT FROM OLD.state_id AND NEW.region_id IS DISTINCT FROM OLD.region_id AND NEW.region_id IS DISTINCT FROM parent_region;
  END IF;
  IF NEW.state_id IS NULL OR legacy_move THEN
    SELECT count(*),min(state_id) INTO candidates,NEW.state_id FROM states WHERE region_id=NEW.region_id AND NOT is_deleted;
    IF candidates<>1 THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Choose a state for this city; its region does not identify one state.'; END IF;
    SELECT region_id INTO parent_region FROM states WHERE state_id=NEW.state_id;
  END IF;
  IF parent_region IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Choose an existing state.'; END IF;
  NEW.region_id := parent_region;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cities_derive_region BEFORE INSERT OR UPDATE OF state_id,region_id ON cities FOR EACH ROW EXECUTE FUNCTION derive_city_region();
CREATE FUNCTION propagate_state_region() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.region_id IS DISTINCT FROM OLD.region_id THEN
    UPDATE cities SET region_id=NEW.region_id WHERE state_id=NEW.state_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_states_region AFTER UPDATE OF region_id ON states FOR EACH ROW EXECUTE FUNCTION propagate_state_region();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='travel_app_dev') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON states TO travel_app_dev;
    GRANT USAGE,SELECT ON SEQUENCE states_state_id_seq TO travel_app_dev;
  END IF;
END $$;
