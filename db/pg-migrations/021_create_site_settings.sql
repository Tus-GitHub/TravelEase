-- Site settings — small key/value store for brand/contact details that an admin
-- can edit at runtime (plan.md call-to-pay model: the "pay by phone" number
-- shown on the confirm page, booking detail and booking emails). An empty or
-- missing value means "fall back to src/data/site.ts", which stays the source
-- of defaults. Like role_permissions this is a config table, not a domain
-- entity, so it carries only updated_by/at (no created_*/is_deleted/is_active).
CREATE TABLE site_settings (
    setting_key   VARCHAR(60)  PRIMARY KEY,
    setting_value VARCHAR(300) NOT NULL DEFAULT '',
    updated_by    UUID REFERENCES users(user_id),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_site_settings_updated_at BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
