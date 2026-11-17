-- Approved 17 November 2026: route-only suggestions, separate from priced packages.
CREATE TABLE route_templates (
  route_template_id SERIAL PRIMARY KEY,
  region_id INTEGER NOT NULL REFERENCES regions(region_id),
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  route_tree JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NULL REFERENCES users(user_id),
  updated_by UUID NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(btrim(name)) BETWEEN 2 AND 160),
  CHECK (jsonb_typeof(route_tree)='object'),
  CHECK (version > 0)
);
CREATE INDEX idx_route_templates_region ON route_templates(region_id) WHERE NOT is_deleted;
CREATE TRIGGER trg_route_templates_updated_at BEFORE UPDATE ON route_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='travel_app_dev') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON route_templates TO travel_app_dev;
    GRANT USAGE,SELECT ON SEQUENCE route_templates_route_template_id_seq TO travel_app_dev;
  END IF;
END $$;
