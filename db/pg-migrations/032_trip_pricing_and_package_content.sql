-- Exact column names/types approved by the user on 15 November 2026.
ALTER TABLE pricing_rules ADD COLUMN empty_return_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pricing_rules ADD COLUMN empty_return_per_km_rate NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pricing_rules ADD CONSTRAINT pricing_empty_return_policy CHECK (
  empty_return_per_km_rate >= 0 AND
  (NOT empty_return_enabled OR (vehicle_id IS NOT NULL AND empty_return_per_km_rate > 0))
);
ALTER TABLE packages ADD COLUMN trip_content JSONB NULL;
ALTER TABLE packages ADD CONSTRAINT packages_trip_content_object
  CHECK (trip_content IS NULL OR jsonb_typeof(trip_content) = 'object');
