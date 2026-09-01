import { getPool } from "./db";

/**
 * Public read layer for the catalogue (plan.md §31). Separate from
 * `src/lib/server/admin/*` — those return admin shapes (internal flags, no
 * images); these return only active, non-deleted rows with the fields the
 * public pages and the Package Builder need. Read-only, no auth.
 */

// ─── Vehicles ────────────────────────────────────────────────────────────────

export interface PublicVehicle {
  id: number;
  name: string;
  typeSlug: string;
  typeTitle: string;
  seatingCapacity: number;
  features: string[];
  pricePerDay: number;
  rating: number | null;
  isAvailable: boolean;
  imageUrl: string | null;
}

export interface PublicVehicleDetail extends PublicVehicle {
  images: string[];
}

export interface VehicleFilters {
  typeSlug?: string;
  minSeats?: number;
  maxPrice?: number;
  availableOnly?: boolean;
}

const PRIMARY_IMAGE_SUBQUERY = `
  (SELECT vi.image_url FROM vehicle_images vi
    WHERE vi.vehicle_id = v.vehicle_id AND vi.is_deleted = false
    ORDER BY vi.is_primary DESC, vi.display_order, vi.vehicle_image_id
    LIMIT 1)`;

const VEHICLE_SELECT = `
  SELECT v.vehicle_id, v.name, vt.slug AS type_slug, vt.title AS type_title,
         v.seating_capacity, v.features, v.base_price_per_day, v.rating, v.is_available,
         ${PRIMARY_IMAGE_SUBQUERY} AS image_url
  FROM vehicles v
  JOIN vehicle_types vt ON vt.vehicle_type_id = v.vehicle_type_id
   AND vt.is_deleted = false AND vt.is_active = true
  WHERE v.is_deleted = false AND v.is_active = true`;

interface VehicleRow {
  vehicle_id: number;
  name: string;
  type_slug: string;
  type_title: string;
  seating_capacity: number;
  features: string[] | null;
  base_price_per_day: string;
  rating: string | null;
  is_available: boolean;
  image_url: string | null;
}

function toPublicVehicle(r: VehicleRow): PublicVehicle {
  return {
    id: r.vehicle_id,
    name: r.name,
    typeSlug: r.type_slug,
    typeTitle: r.type_title,
    seatingCapacity: r.seating_capacity,
    features: Array.isArray(r.features) ? r.features : [],
    pricePerDay: Number(r.base_price_per_day),
    rating: r.rating != null ? Number(r.rating) : null,
    isAvailable: r.is_available,
    imageUrl: r.image_url,
  };
}

export async function listPublicVehicles(
  filters: VehicleFilters = {},
): Promise<PublicVehicle[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.typeSlug) {
    params.push(filters.typeSlug);
    where.push(`vt.slug = $${params.length}`);
  }
  if (filters.minSeats && filters.minSeats > 0) {
    params.push(filters.minSeats);
    where.push(`v.seating_capacity >= $${params.length}`);
  }
  if (filters.maxPrice && filters.maxPrice > 0) {
    params.push(filters.maxPrice);
    where.push(`v.base_price_per_day <= $${params.length}`);
  }
  if (filters.availableOnly) where.push(`v.is_available = true`);

  const sql =
    VEHICLE_SELECT +
    (where.length ? ` AND ${where.join(" AND ")}` : "") +
    ` ORDER BY v.display_order, v.vehicle_id`;
  const result = await getPool().query(sql, params);
  return result.rows.map(toPublicVehicle);
}

export async function getPublicVehicle(id: number): Promise<PublicVehicleDetail | null> {
  if (!Number.isInteger(id)) return null;
  const pool = getPool();
  const [vehicle, images] = await Promise.all([
    pool.query(`${VEHICLE_SELECT} AND v.vehicle_id = $1`, [id]),
    pool.query(
      `SELECT image_url FROM vehicle_images
        WHERE vehicle_id = $1 AND is_deleted = false
        ORDER BY is_primary DESC, display_order, vehicle_image_id`,
      [id],
    ),
  ]);
  if (!vehicle.rows[0]) return null;
  return {
    ...toPublicVehicle(vehicle.rows[0]),
    images: images.rows.map((r) => r.image_url as string),
  };
}

// ─── Packages ────────────────────────────────────────────────────────────────

export interface PublicPackageStop {
  touristSpotId: number;
  name: string;
  tag: string | null;
  description: string | null;
  imageUrl: string | null;
  stopOrder: number;
  nightsHere: number;
}

export interface PublicPackage {
  id: number;
  slug: string;
  name: string;
  regionId: number;
  regionName: string;
  vehicleTypeSlug: string;
  vehicleTypeTitle: string;
  durationDays: number;
  imageUrl: string | null;
  highlights: string[];
  maxPersons: number;
  pricePerPerson: number;
  tag: string | null;
  rating: number | null;
  reviewCount: number;
  destinations: string[];
}

export interface PublicPackageDetail extends PublicPackage {
  stops: PublicPackageStop[];
}

const PACKAGE_SELECT = `
  SELECT p.package_id, p.slug, p.name, p.region_id, r.name AS region_name,
         vt.slug AS vehicle_type_slug, vt.title AS vehicle_type_title,
         p.duration_days, p.image_url, p.highlights, p.max_persons,
         p.price_per_person, p.tag, p.rating, p.review_count
  FROM packages p
  JOIN regions r ON r.region_id = p.region_id AND r.is_deleted = false
  JOIN vehicle_types vt ON vt.vehicle_type_id = p.vehicle_type_id
  WHERE p.is_deleted = false AND p.is_active = true`;

const PACKAGE_STOPS_SELECT = `
  SELECT ps.package_id, ps.tourist_spot_id, ts.name, ts.tag, ts.description,
         ts.image_url, ps.stop_order, ps.nights_here
  FROM package_stops ps
  JOIN tourist_spots ts ON ts.tourist_spot_id = ps.tourist_spot_id
  WHERE ps.is_deleted = false`;

interface PackageRow {
  package_id: number;
  slug: string;
  name: string;
  region_id: number;
  region_name: string;
  vehicle_type_slug: string;
  vehicle_type_title: string;
  duration_days: number;
  image_url: string | null;
  highlights: string[] | null;
  max_persons: number;
  price_per_person: string;
  tag: string | null;
  rating: string | null;
  review_count: number;
}

interface StopRow {
  package_id: number;
  tourist_spot_id: number;
  name: string;
  tag: string | null;
  description: string | null;
  image_url: string | null;
  stop_order: number;
  nights_here: number;
}

function toStop(r: StopRow): PublicPackageStop {
  return {
    touristSpotId: r.tourist_spot_id,
    name: r.name,
    tag: r.tag,
    description: r.description,
    imageUrl: r.image_url,
    stopOrder: r.stop_order,
    nightsHere: r.nights_here,
  };
}

function toPublicPackage(r: PackageRow, stops: PublicPackageStop[]): PublicPackageDetail {
  return {
    id: r.package_id,
    slug: r.slug,
    name: r.name,
    regionId: r.region_id,
    regionName: r.region_name,
    vehicleTypeSlug: r.vehicle_type_slug,
    vehicleTypeTitle: r.vehicle_type_title,
    durationDays: r.duration_days,
    imageUrl: r.image_url,
    highlights: Array.isArray(r.highlights) ? r.highlights : [],
    maxPersons: r.max_persons,
    pricePerPerson: Number(r.price_per_person),
    tag: r.tag,
    rating: r.rating != null ? Number(r.rating) : null,
    reviewCount: r.review_count,
    destinations: stops.map((s) => s.name),
    stops,
  };
}

export async function listPublicPackages(): Promise<PublicPackage[]> {
  const pool = getPool();
  const [pkgs, stops] = await Promise.all([
    pool.query(`${PACKAGE_SELECT} ORDER BY p.display_order, p.package_id`),
    pool.query(`${PACKAGE_STOPS_SELECT} ORDER BY ps.stop_order`),
  ]);
  const byPackage = new Map<number, PublicPackageStop[]>();
  for (const row of stops.rows as StopRow[]) {
    const list = byPackage.get(row.package_id) ?? [];
    list.push(toStop(row));
    byPackage.set(row.package_id, list);
  }
  return pkgs.rows.map((r) => toPublicPackage(r, byPackage.get(r.package_id) ?? []));
}

/** Looks a package up by numeric id or by slug. */
export async function getPublicPackage(
  idOrSlug: string,
): Promise<PublicPackageDetail | null> {
  const asId = /^\d+$/.test(idOrSlug) ? Number(idOrSlug) : null;
  const pool = getPool();
  const pkg = await pool.query(
    `${PACKAGE_SELECT} AND ($1::int IS NOT NULL AND p.package_id = $1 OR p.slug = $2) LIMIT 1`,
    [asId, idOrSlug],
  );
  if (!pkg.rows[0]) return null;
  const stops = await pool.query(
    `${PACKAGE_STOPS_SELECT} AND ps.package_id = $1 ORDER BY ps.stop_order`,
    [pkg.rows[0].package_id],
  );
  return toPublicPackage(pkg.rows[0], (stops.rows as StopRow[]).map(toStop));
}

// ─── Regions (with spots, for the Package Builder) ───────────────────────────

export interface PublicRegionSpot {
  id: number;
  name: string;
  tag: string | null;
  description: string | null;
  imageUrl: string | null;
  cityId: number;
  cityName: string;
}

export interface PublicRegion {
  id: number;
  name: string;
  state: string;
  imageUrl: string | null;
  spots: PublicRegionSpot[];
}

export async function listPublicRegions(): Promise<PublicRegion[]> {
  const pool = getPool();
  const [regions, spots] = await Promise.all([
    pool.query(
      `SELECT region_id, name, state, image_url FROM regions
        WHERE is_deleted = false AND is_active = true
        ORDER BY display_order, region_id`,
    ),
    pool.query(
      `SELECT c.region_id, ts.tourist_spot_id, ts.name, ts.tag, ts.description,
              ts.image_url, ts.city_id, c.name AS city_name
         FROM tourist_spots ts
         JOIN cities c ON c.city_id = ts.city_id AND c.is_deleted = false
        WHERE ts.is_deleted = false
        ORDER BY ts.display_order, ts.tourist_spot_id`,
    ),
  ]);

  const byRegion = new Map<number, PublicRegionSpot[]>();
  for (const s of spots.rows) {
    const list = byRegion.get(s.region_id) ?? [];
    list.push({
      id: s.tourist_spot_id,
      name: s.name,
      tag: s.tag,
      description: s.description,
      imageUrl: s.image_url,
      cityId: s.city_id,
      cityName: s.city_name,
    });
    byRegion.set(s.region_id, list);
  }

  return regions.rows.map((r) => ({
    id: r.region_id,
    name: r.name,
    state: r.state,
    imageUrl: r.image_url,
    spots: byRegion.get(r.region_id) ?? [],
  }));
}
