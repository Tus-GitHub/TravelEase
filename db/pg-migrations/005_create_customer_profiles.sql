CREATE TABLE customer_profiles (
    customer_profile_id SERIAL PRIMARY KEY,
    user_id             UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    address_line1       VARCHAR(200),
    address_line2       VARCHAR(200),
    city                VARCHAR(100),
    state               VARCHAR(100),
    pincode             VARCHAR(10),
    latitude            NUMERIC(9,6),
    longitude           NUMERIC(9,6),
    preferred_tags      JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
