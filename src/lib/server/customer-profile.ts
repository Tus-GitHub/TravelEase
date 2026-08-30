import { getPool } from "./db";

/**
 * One row per customer (plan.md §12a). Agents/admins never get a row here.
 * `preferred_tags` is a JSONB string array matched against `tourist_spots.tag`.
 * `latitude`/`longitude` come from the profile map picker and power the
 * distance-ranked "places near you" recommendation.
 */
export interface CustomerProfile {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  preferredTags: string[];
}

interface CustomerProfileRow {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: string | null;
  longitude: string | null;
  preferred_tags: string[] | null;
}

const PROFILE_COLUMNS =
  "address_line1, address_line2, city, state, pincode, latitude, longitude, preferred_tags";

function toCustomerProfile(row: CustomerProfileRow): CustomerProfile {
  return {
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2 ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    pincode: row.pincode ?? "",
    // NUMERIC comes back from pg as a string.
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    preferredTags: Array.isArray(row.preferred_tags) ? row.preferred_tags : [],
  };
}

// Every read against the audited domain tables must exclude soft-deleted rows
// (plan.md §19a) — no shared query helper exists yet, so it's inline here.
export async function getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT ${PROFILE_COLUMNS} FROM customer_profiles
     WHERE user_id = $1 AND is_deleted = false`,
    [userId],
  );
  return result.rows[0] ? toCustomerProfile(result.rows[0]) : null;
}

export async function upsertCustomerProfile(
  userId: string,
  input: CustomerProfile,
): Promise<CustomerProfile> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO customer_profiles
       (user_id, address_line1, address_line2, city, state, pincode, latitude, longitude, preferred_tags, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $1, $1)
     ON CONFLICT (user_id) DO UPDATE SET
       address_line1  = EXCLUDED.address_line1,
       address_line2  = EXCLUDED.address_line2,
       city           = EXCLUDED.city,
       state          = EXCLUDED.state,
       pincode        = EXCLUDED.pincode,
       latitude       = EXCLUDED.latitude,
       longitude      = EXCLUDED.longitude,
       preferred_tags = EXCLUDED.preferred_tags,
       updated_by     = EXCLUDED.updated_by,
       is_deleted     = false
     RETURNING ${PROFILE_COLUMNS}`,
    [
      userId,
      input.addressLine1.trim() || null,
      input.addressLine2.trim() || null,
      input.city.trim() || null,
      input.state.trim() || null,
      input.pincode.trim() || null,
      input.latitude,
      input.longitude,
      JSON.stringify(input.preferredTags),
    ],
  );
  return toCustomerProfile(result.rows[0]);
}
