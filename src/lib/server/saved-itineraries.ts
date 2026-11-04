import { getPool } from "./db";

/**
 * Saved itineraries (Phase 3, plan.md §20/§38). A signed-in customer saves a
 * Package Builder route (`custom`) or a curated package (`curated`) without
 * booking, then one-click rebooks it later. This is the "what / where", never
 * the "when" — travel dates are chosen fresh on `/booking/new`.
 *
 * All functions are scoped to the owning `userId` (IDOR-safe, plan.md §26).
 */

export type SavedItineraryKind = "curated" | "custom";

/** How many a single user may keep. */
export const SAVED_ITINERARY_LIMIT = 100;

/** A custom route needs at least this many resolvable stops to be rebookable
 *  (matches the Package Builder's MIN_SPOTS). */
const MIN_CUSTOM_STOPS = 2;

export interface SavedItineraryStop {
  id: number;
  name: string;
}

export interface SavedItineraryView {
  id: string;
  kind: SavedItineraryKind;
  title: string;
  createdAt: string;
  packageId: number | null;
  packageSlug: string | null;
  packageName: string | null;
  regionId: number | null;
  regionName: string | null;
  vehicleTypeId: number | null;
  vehicleTypeSlug: string | null;
  vehicleTypeTitle: string | null;
  /** Resolved & ordered; spots that were since deleted are dropped. */
  stops: SavedItineraryStop[];
  /** false when the rebook link would no longer work (curated package gone /
   *  inactive, or a custom route worn down to < 2 valid stops). */
  available: boolean;
}

interface Row {
  saved_itinerary_id: string;
  kind: SavedItineraryKind;
  title: string;
  created_at: Date;
  package_id: number | null;
  package_slug: string | null;
  package_name: string | null;
  package_ok: boolean;
  region_id: number | null;
  region_name: string | null;
  vehicle_type_id: number | null;
  vehicle_type_slug: string | null;
  vehicle_type_title: string | null;
  spot_ids: unknown;
}

const SELECT = `
  SELECT si.saved_itinerary_id, si.kind, si.title, si.created_at,
         si.package_id, p.slug AS package_slug, p.name AS package_name,
         (p.package_id IS NOT NULL AND p.is_deleted = false AND p.is_active = true) AS package_ok,
         si.region_id, r.name AS region_name,
         si.vehicle_type_id, vt.slug AS vehicle_type_slug, vt.title AS vehicle_type_title,
         si.spot_ids
    FROM saved_itineraries si
    LEFT JOIN packages p       ON p.package_id = si.package_id
    LEFT JOIN regions r        ON r.region_id = si.region_id
    LEFT JOIN vehicle_types vt ON vt.vehicle_type_id = si.vehicle_type_id
   WHERE si.user_id = $1 AND si.is_deleted = false
`;

function spotIdList(raw: unknown): number[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);
}

async function hydrate(rows: Row[]): Promise<SavedItineraryView[]> {
  // Resolve every referenced spot name in one query, then map per row in order.
  const allIds = Array.from(new Set(rows.flatMap((r) => spotIdList(r.spot_ids))));
  const names = new Map<number, string>();
  if (allIds.length) {
    const r = await getPool().query(
      `SELECT tourist_spot_id, name FROM tourist_spots
        WHERE tourist_spot_id = ANY($1) AND is_deleted = false`,
      [allIds],
    );
    for (const row of r.rows) names.set(row.tourist_spot_id as number, row.name as string);
  }

  return rows.map((r) => {
    const stops: SavedItineraryStop[] = spotIdList(r.spot_ids)
      .filter((id) => names.has(id))
      .map((id) => ({ id, name: names.get(id)! }));
    const available =
      r.kind === "curated" ? r.package_ok === true : stops.length >= MIN_CUSTOM_STOPS;
    return {
      id: r.saved_itinerary_id,
      kind: r.kind,
      title: r.title,
      createdAt: new Date(r.created_at).toISOString(),
      packageId: r.package_id,
      packageSlug: r.package_slug,
      packageName: r.package_name,
      regionId: r.region_id,
      regionName: r.region_name,
      vehicleTypeId: r.vehicle_type_id,
      vehicleTypeSlug: r.vehicle_type_slug,
      vehicleTypeTitle: r.vehicle_type_title,
      stops,
      available,
    };
  });
}

export async function listSavedItineraries(userId: string): Promise<SavedItineraryView[]> {
  const r = await getPool().query(`${SELECT} ORDER BY si.created_at DESC`, [userId]);
  return hydrate(r.rows as Row[]);
}

async function getSavedItinerary(
  id: string,
  userId: string,
): Promise<SavedItineraryView | null> {
  const r = await getPool().query(
    `${SELECT} AND si.saved_itinerary_id = $2`,
    [userId, id],
  );
  return r.rows[0] ? (await hydrate([r.rows[0] as Row]))[0] : null;
}

// ─── Create ────────────────────────────────────────────────────────────────

export interface CreateSavedInput {
  kind: SavedItineraryKind;
  packageId?: number | null;
  packageSlug?: string | null;
  regionId?: number | null;
  vehicleTypeId?: number | null;
  vehicleTypeSlug?: string | null;
  spotIds?: number[];
  title?: string;
}

export type CreateSavedResult =
  | { ok: true; item: SavedItineraryView }
  | { ok: false; status: number; message: string };

export async function createSavedItinerary(
  userId: string,
  input: CreateSavedInput,
): Promise<CreateSavedResult> {
  if (input.kind !== "curated" && input.kind !== "custom") {
    return { ok: false, status: 400, message: "Unknown itinerary kind." };
  }

  const pool = getPool();

  const count = (
    await pool.query(
      `SELECT count(*)::int AS n FROM saved_itineraries
        WHERE user_id = $1 AND is_deleted = false`,
      [userId],
    )
  ).rows[0].n as number;
  if (count >= SAVED_ITINERARY_LIMIT) {
    return {
      ok: false,
      status: 409,
      message: `You've saved the maximum of ${SAVED_ITINERARY_LIMIT} trips. Remove one to save another.`,
    };
  }

  // Optional vehicle type — accept an id or a slug.
  let vehicleTypeId: number | null = null;
  if (typeof input.vehicleTypeId === "number" && Number.isInteger(input.vehicleTypeId)) {
    vehicleTypeId = input.vehicleTypeId;
  } else if (typeof input.vehicleTypeSlug === "string" && input.vehicleTypeSlug.trim()) {
    const vt = await pool.query(
      `SELECT vehicle_type_id FROM vehicle_types
        WHERE slug = $1 AND is_deleted = false`,
      [input.vehicleTypeSlug.trim()],
    );
    vehicleTypeId = vt.rows[0]?.vehicle_type_id ?? null;
  }
  if (vehicleTypeId != null) {
    const ok = await pool.query(
      `SELECT 1 FROM vehicle_types WHERE vehicle_type_id = $1 AND is_deleted = false`,
      [vehicleTypeId],
    );
    if (!ok.rowCount) {
      return { ok: false, status: 400, message: "That vehicle type doesn't exist." };
    }
  }

  let packageId: number | null = null;
  let regionId: number | null = null;
  let spotIds: number[] = [];
  let defaultTitle = "Saved trip";

  if (input.kind === "curated") {
    const asId =
      typeof input.packageId === "number" && Number.isInteger(input.packageId)
        ? input.packageId
        : null;
    const slug =
      typeof input.packageSlug === "string" && input.packageSlug.trim()
        ? input.packageSlug.trim()
        : null;
    if (asId == null && slug == null) {
      return { ok: false, status: 400, message: "A package is required." };
    }
    const pkg = (
      await pool.query(
        `SELECT package_id, name FROM packages
          WHERE is_deleted = false AND is_active = true
            AND ($1::int IS NOT NULL AND package_id = $1 OR slug = $2)
          LIMIT 1`,
        [asId, slug],
      )
    ).rows[0];
    if (!pkg) return { ok: false, status: 404, message: "Package not found." };
    packageId = pkg.package_id;
    defaultTitle = pkg.name;
  } else {
    spotIds = Array.from(
      new Set(
        (Array.isArray(input.spotIds) ? input.spotIds : [])
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    );
    if (spotIds.length < MIN_CUSTOM_STOPS) {
      return { ok: false, status: 400, message: `Pick at least ${MIN_CUSTOM_STOPS} stops.` };
    }
    const found = await pool.query(
      `SELECT tourist_spot_id FROM tourist_spots
        WHERE tourist_spot_id = ANY($1) AND is_deleted = false`,
      [spotIds],
    );
    if (found.rowCount !== spotIds.length) {
      return { ok: false, status: 400, message: "One or more stops are invalid." };
    }
    // region_id is just a label — keep it only if it resolves, never hard-fail.
    if (typeof input.regionId === "number" && Number.isInteger(input.regionId)) {
      const r = await pool.query(
        `SELECT name FROM regions WHERE region_id = $1 AND is_deleted = false`,
        [input.regionId],
      );
      if (r.rows[0]) {
        regionId = input.regionId;
        defaultTitle = `${r.rows[0].name} itinerary`;
      } else {
        defaultTitle = "Custom itinerary";
      }
    } else {
      defaultTitle = "Custom itinerary";
    }
  }

  const title = (typeof input.title === "string" && input.title.trim()
    ? input.title.trim()
    : defaultTitle
  ).slice(0, 120);

  const res = await pool.query(
    `INSERT INTO saved_itineraries
       (user_id, kind, title, package_id, region_id, vehicle_type_id, spot_ids,
        created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $1, $1)
     RETURNING saved_itinerary_id`,
    [userId, input.kind, title, packageId, regionId, vehicleTypeId, JSON.stringify(spotIds)],
  );

  return { ok: true, item: (await getSavedItinerary(res.rows[0].saved_itinerary_id, userId))! };
}

// ─── Rename / delete ───────────────────────────────────────────────────────

export async function renameSavedItinerary(
  id: string,
  userId: string,
  title: string,
): Promise<boolean> {
  const clean = title.trim().slice(0, 120);
  if (!clean) return false;
  const r = await getPool().query(
    `UPDATE saved_itineraries SET title = $3, updated_by = $2
      WHERE saved_itinerary_id = $1 AND user_id = $2 AND is_deleted = false`,
    [id, userId, clean],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function deleteSavedItinerary(id: string, userId: string): Promise<boolean> {
  const r = await getPool().query(
    `UPDATE saved_itineraries SET is_deleted = true, updated_by = $2
      WHERE saved_itinerary_id = $1 AND user_id = $2 AND is_deleted = false`,
    [id, userId],
  );
  return (r.rowCount ?? 0) > 0;
}
