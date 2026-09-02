-- Chunk 2.7 — reviews (plan.md §37 "Reviews"). One review per completed trip;
-- an admin can unpublish or soft-delete. Replaces the static testimonials.
CREATE TABLE reviews (
    review_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id   UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(user_id),
    rating       INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title        VARCHAR(120),
    body         VARCHAR(2000),
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_by   UUID REFERENCES users(user_id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   UUID REFERENCES users(user_id),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted   BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (booking_id)
);
CREATE INDEX idx_reviews_published ON reviews (is_published, is_deleted);

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
