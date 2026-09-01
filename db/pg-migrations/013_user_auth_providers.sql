-- Chunk 1.14 — Google OAuth (plan.md §21–22).
--
-- One row per external identity linked to a TravelEase user. A separate table
-- (not provider columns on `users`) so Apple / Microsoft / etc. can be added
-- later without touching `users`. TravelEase stays the source of truth for the
-- User, Role and Session — Google is only the auth provider.
CREATE TABLE user_auth_providers (
    user_auth_provider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider         VARCHAR(30)  NOT NULL,   -- 'google'
    provider_user_id VARCHAR(255) NOT NULL,   -- the provider's stable subject id (Google 'sub')
    email            VARCHAR(320),            -- email the provider reported at link time (reference only)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_uap_user_id ON user_auth_providers (user_id);
