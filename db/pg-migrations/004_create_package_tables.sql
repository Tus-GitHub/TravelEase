CREATE TABLE packages (
    package_id        SERIAL PRIMARY KEY,
    region_id         INT NOT NULL REFERENCES regions(region_id),
    vehicle_type_id   INT NOT NULL REFERENCES vehicle_types(vehicle_type_id),
    name              VARCHAR(150) NOT NULL,
    slug              VARCHAR(80) NOT NULL UNIQUE,
    duration_days     INT NOT NULL,
    image_url         VARCHAR(500),
    highlights        JSONB,
    max_persons       INT NOT NULL,
    price_per_person  NUMERIC(10,2) NOT NULL,
    tag               VARCHAR(40),
    rating            NUMERIC(2,1),
    review_count      INT NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE package_stops (
    package_stop_id  SERIAL PRIMARY KEY,
    package_id       INT NOT NULL REFERENCES packages(package_id) ON DELETE CASCADE,
    tourist_spot_id  INT NOT NULL REFERENCES tourist_spots(tourist_spot_id),
    stop_order       INT NOT NULL,
    nights_here      INT NOT NULL DEFAULT 0
);
