CREATE TABLE activity_logs (
    log_id      BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(user_id),   -- NULL = system-triggered
    action      VARCHAR(100) NOT NULL,            -- e.g. 'user.login', 'vehicle.create', 'booking.cancel'
    entity_type VARCHAR(50),                      -- e.g. 'vehicle', 'package', 'user'
    entity_id   VARCHAR(50),                      -- affected row's id, as text (ids vary: UUID vs INT)
    details     JSONB,                            -- free-form context, e.g. old/new values
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
