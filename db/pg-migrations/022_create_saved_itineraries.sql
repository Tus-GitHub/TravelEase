-- Phase 3 — saved itineraries (plan.md §20/§38 "SavedItineraries").
-- A signed-in customer saves a Package Builder route ('custom') or a curated
-- package ('curated') WITHOUT booking, then one-click rebooks it later with
-- dates chosen fresh. spot_ids is the ordered tourist_spot_id list for a custom
-- route ([] for curated). Audit set matches reviews/drivers (no is_active,
-- no display_order); soft-delete via is_deleted, filtered on every read.
CREATE TABLE saved_itineraries (
    saved_itinerary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    kind               VARCHAR(10) NOT NULL CHECK (kind IN ('curated','custom')),
    title              VARCHAR(120) NOT NULL,
    package_id         INT REFERENCES packages(package_id) ON DELETE CASCADE,
    region_id          INT REFERENCES regions(region_id) ON DELETE SET NULL,
    vehicle_type_id    INT REFERENCES vehicle_types(vehicle_type_id) ON DELETE SET NULL,
    spot_ids           JSONB NOT NULL DEFAULT '[]',
    created_by  UUID REFERENCES users(user_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_saved_itineraries_user ON saved_itineraries (user_id, is_deleted);

CREATE TRIGGER trg_saved_itineraries_updated_at BEFORE UPDATE ON saved_itineraries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
