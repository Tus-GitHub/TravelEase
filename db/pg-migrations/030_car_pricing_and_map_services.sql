-- User approved these names/types on 2026-11-14. Existing rules remain fallbacks.
ALTER TABLE pricing_rules ADD COLUMN vehicle_id INTEGER NULL REFERENCES vehicles(vehicle_id);
CREATE INDEX idx_pricing_rules_vehicle ON pricing_rules(vehicle_id, booking_type_id) WHERE NOT is_deleted;

CREATE TABLE map_service_cache (
  cache_key CHAR(64) PRIMARY KEY,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('nominatim', 'fossgis')),
  response JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_map_service_cache_expiry ON map_service_cache(expires_at);
CREATE TABLE map_service_usage (
  provider VARCHAR(20) PRIMARY KEY CHECK (provider IN ('nominatim', 'fossgis')),
  usage_date DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  last_request_at TIMESTAMPTZ NULL
);

-- Existing optional development runtime role; no role/credential is created.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'travel_app_dev') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON map_service_cache, map_service_usage TO travel_app_dev;
  END IF;
END $$;
