-- Chunk 1.15 — email verification + password reset (plan.md §24).
--
-- NULL email_verified_at = the account has not confirmed its email address.
-- Backfill every existing row to now(): all current accounts predate this flow
-- and must keep working. From here on, email/password signups start as NULL and
-- are gated at login until they click the verification link; Google sign-ups
-- (chunk 1.14) will be created already-verified.
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
UPDATE users SET email_verified_at = now() WHERE email_verified_at IS NULL;

-- Single-use, hashed, expiring tokens. The raw token travels only in the emailed
-- link; only its SHA-256 hex is stored (plan.md §24). consumed_at is set
-- atomically on redemption so a link cannot be replayed.
CREATE TABLE email_verification_tokens (
    token_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash  CHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evt_token_hash ON email_verification_tokens (token_hash);
CREATE INDEX idx_evt_user_id    ON email_verification_tokens (user_id);

CREATE TABLE password_reset_tokens (
    token_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash  CHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prt_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX idx_prt_user_id    ON password_reset_tokens (user_id);
