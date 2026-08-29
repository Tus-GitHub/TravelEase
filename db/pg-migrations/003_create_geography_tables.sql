CREATE TABLE regions (
    region_id SERIAL PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    state     VARCHAR(100) NOT NULL,
    image_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE cities (
    city_id         SERIAL PRIMARY KEY,
    region_id       INT NOT NULL REFERENCES regions(region_id),
    name            VARCHAR(100) NOT NULL,
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    is_pickup_point BOOLEAN NOT NULL DEFAULT true,
    is_airport      BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE tourist_spots (
    tourist_spot_id SERIAL PRIMARY KEY,
    city_id         INT NOT NULL REFERENCES cities(city_id),
    name            VARCHAR(150) NOT NULL,
    tag             VARCHAR(60),
    description     VARCHAR(1000),
    image_url       VARCHAR(500),
    display_order   INT NOT NULL DEFAULT 0
);
