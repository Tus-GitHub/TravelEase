CREATE TABLE vehicle_types (
    vehicle_type_id SERIAL PRIMARY KEY,
    slug            VARCHAR(60)  NOT NULL UNIQUE,
    title           VARCHAR(100) NOT NULL,
    description     VARCHAR(500),
    icon_name       VARCHAR(40),
    image_url       VARCHAR(500),
    display_order   INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE vehicles (
    vehicle_id          SERIAL PRIMARY KEY,
    vehicle_type_id     INT NOT NULL REFERENCES vehicle_types(vehicle_type_id),
    name                VARCHAR(150) NOT NULL,
    registration_number VARCHAR(20),
    seating_capacity    INT NOT NULL,
    features            JSONB,
    base_price_per_day  NUMERIC(10,2) NOT NULL,
    rating              NUMERIC(2,1),
    is_available        BOOLEAN NOT NULL DEFAULT true,
    managed_by_user_id  UUID REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_images (
    vehicle_image_id SERIAL PRIMARY KEY,
    vehicle_id       INT NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    image_url        VARCHAR(500) NOT NULL,
    is_primary       BOOLEAN NOT NULL DEFAULT false,
    display_order    INT NOT NULL DEFAULT 0
);
