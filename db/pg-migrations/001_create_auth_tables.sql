CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    name    VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    email         VARCHAR(320) NOT NULL UNIQUE,
    phone         VARCHAR(30)  NOT NULL,
    password_hash VARCHAR(400) NOT NULL,
    role_id       INT NOT NULL REFERENCES roles(role_id) DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    token      UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

INSERT INTO roles (role_id, name) VALUES (1, 'customer'), (2, 'agent'), (3, 'admin');
