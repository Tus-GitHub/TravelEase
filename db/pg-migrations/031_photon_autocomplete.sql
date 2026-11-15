-- Photon permits type-ahead queries; Nominatim remains manual-search only.
-- Extend the existing shared quota/cache rather than introducing another store.
ALTER TABLE map_service_cache DROP CONSTRAINT map_service_cache_provider_check;
ALTER TABLE map_service_cache ADD CONSTRAINT map_service_cache_provider_check
  CHECK (provider IN ('nominatim', 'fossgis', 'photon'));
ALTER TABLE map_service_usage DROP CONSTRAINT map_service_usage_provider_check;
ALTER TABLE map_service_usage ADD CONSTRAINT map_service_usage_provider_check
  CHECK (provider IN ('nominatim', 'fossgis', 'photon'));
