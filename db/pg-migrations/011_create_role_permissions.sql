-- Persists the admin sidebar-section permission matrix (was in-memory in
-- AdminPermissionsContext). Only 'agent' and 'customer' are stored/editable;
-- 'admin' is always-allowed in code and never gets a row here.
-- plan.md §9 conflict (fixed roles vs. editable matrix) is still unresolved —
-- this just makes the existing feature durable.

CREATE TABLE role_permissions (
    role_permission_id SERIAL PRIMARY KEY,
    role_id            INT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    section            VARCHAR(40) NOT NULL,
    is_allowed         BOOLEAN NOT NULL DEFAULT false,
    updated_by         UUID REFERENCES users(user_id),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (role_id, section)
);

CREATE TRIGGER trg_role_permissions_updated_at BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Defaults mirror the old DEFAULT_MATRIX: agent gets vehicles/geography/packages.
INSERT INTO role_permissions (role_id, section, is_allowed) VALUES
  ((SELECT role_id FROM roles WHERE name = 'agent'),    'users',     false),
  ((SELECT role_id FROM roles WHERE name = 'agent'),    'vehicles',  true),
  ((SELECT role_id FROM roles WHERE name = 'agent'),    'geography', true),
  ((SELECT role_id FROM roles WHERE name = 'agent'),    'packages',  true),
  ((SELECT role_id FROM roles WHERE name = 'customer'), 'users',     false),
  ((SELECT role_id FROM roles WHERE name = 'customer'), 'vehicles',  false),
  ((SELECT role_id FROM roles WHERE name = 'customer'), 'geography', false),
  ((SELECT role_id FROM roles WHERE name = 'customer'), 'packages',  false);
