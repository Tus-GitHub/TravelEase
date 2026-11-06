-- Names/types approved by the user on 2026-11-05, development only.
ALTER TABLE tourist_spots
  ADD COLUMN latitude DOUBLE PRECISION NULL,
  ADD COLUMN longitude DOUBLE PRECISION NULL,
  ADD CONSTRAINT tourist_spots_coordinates_valid CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude IS NOT NULL AND longitude IS NOT NULL
     AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  );
