import { getPool } from "./db";
import { validatePackageContent, availableRouteTree, routeRange, type PackageContent } from "../package-content";
import { planSpotNames } from "./package-plan";
import { unavailableVehicleIds } from "./availability";
import { regionPhoto } from "../region-photo";
import { ROUTE_STOP_TAG } from "../route-stop";
import type { Vehicle, TravelPackage, PackageTag, Region } from "@/types";

/**
 * Public read layer for the catalogue (plan.md §31). Separate from
 * `src/lib/server/admin/*` — those return admin shapes (internal flags, no
 * images); these return only active, non-deleted rows with the fields the
 * public pages and the Package Builder need. Read-only, no auth.
 */

/** Used when a vehicle has no image row yet. */
export const VEHICLE_IMAGE_FALLBACK =
  "/images/vehicle-placeholder.svg";

/** Used when a package / stop has no image. */
export const PACKAGE_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80";

const PACKAGE_TAGS: PackageTag[] = ["Popular", "Best Value", "Premium", "Adventure"];

/** Coerce a free-text `packages.tag` to one of the card's known styles. */
export function normalizePackageTag(tag: string | null): PackageTag {
  return PACKAGE_TAGS.find((t) => t === tag) ?? "Popular";
}

// ─── Vehicles ────────────────────────────────────────────────────────────────

export interface PublicVehicle {
  pricePerKm: number | null;
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
  /** When both are set, drop vehicles with an availability conflict in the window. */
  availableFrom?: Date;
  availableTo?: Date;
}

const PRIMARY_IMAGE_SUBQUERY = `
  (SELECT vi.image_url FROM vehicle_images vi
    WHERE vi.vehicle_id = v.vehicle_id AND vi.is_deleted = false
    ORDER BY vi.is_primary DESC, vi.display_order, vi.vehicle_image_id
    LIMIT 1)`;

const VEHICLE_SELECT = `
  SELECT v.vehicle_id, v.name, vt.slug AS type_slug, vt.title AS type_title,
         v.seating_capacity, v.features, v.base_price_per_day, v.rating, v.is_available,
         ${PRIMARY_IMAGE_SUBQUERY} AS image_url,
         (SELECT p.per_km_rate FROM pricing_rules p JOIN booking_types bt USING(booking_type_id)
          WHERE p.vehicle_id=v.vehicle_id AND bt.code='point_to_point' AND NOT p.is_deleted AND p.is_active
          AND (p.effective_from IS NULL OR p.effective_from<=CURRENT_DATE) AND (p.effective_to IS NULL OR p.effective_to>=CURRENT_DATE)
          ORDER BY p.priority DESC,p.pricing_rule_id LIMIT 1) AS per_km_rate
  FROM vehicles v
  JOIN vehicle_types vt ON vt.vehicle_type_id = v.vehicle_type_id
   AND vt.is_deleted = false AND vt.is_active = true
  WHERE v.is_deleted = false AND v.is_active = true`;

interface VehicleRow {
  per_km_rate: string | null;
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
    pricePerKm: r.per_km_rate==null?null:Number(r.per_km_rate),
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

  if (
    filters.availableFrom &&
    filters.availableTo &&
    filters.availableTo > filters.availableFrom
  ) {
    const busy = await unavailableVehicleIds(filters.availableFrom, filters.availableTo);
    if (busy.length) {
      params.push(busy);
      where.push(`v.vehicle_id <> ALL($${params.length})`);
    }
  }

  const sql =
    VEHICLE_SELECT +
    (where.length ? ` AND ${where.join(" AND ")}` : "") +
    ` ORDER BY v.display_order, v.vehicle_id`;
  const result = await getPool().query(sql, params);
  return result.rows.map(toPublicVehicle);
}

export interface PublicVehicleType {
  id: number;
  slug: string;
  title: string;
}

export async function listPublicVehicleTypes(): Promise<PublicVehicleType[]> {
  const r = await getPool().query(
    `SELECT vehicle_type_id, slug, title FROM vehicle_types
      WHERE is_deleted = false AND is_active = true
      ORDER BY display_order, vehicle_type_id`,
  );
  return r.rows.map((x) => ({ id: x.vehicle_type_id, slug: x.slug, title: x.title }));
}

/** Adapt a PublicVehicle to the `@/types` Vehicle shape the cards render. */
export function toCardVehicle(v: PublicVehicle): Vehicle {
  return {
    id: String(v.id),
    name: v.name,
    type: v.typeTitle,
    imageUrl: v.imageUrl ?? VEHICLE_IMAGE_FALLBACK,
    seatingCapacity: v.seatingCapacity,
    features: v.features,
    pricePerDay: v.pricePerDay,
    rating: v.rating ?? 0,
    isAvailable: v.isAvailable,
  };
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
  guidedPlan?: TravelPackage["guidedPlan"];
  destinationIds?: number[];
  isGuided: boolean;
  isBookable: boolean;
  durationMaxDays?: number;
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
  tripContent: PackageContent | null;
  basePricePerPerson: number;
  routeDestinations: { id: number; name: string }[];
  stops: PublicPackageStop[];
}

const PACKAGE_SELECT = `
  SELECT p.package_id, p.slug, p.name, p.region_id, r.name AS region_name,
         vt.slug AS vehicle_type_slug, vt.title AS vehicle_type_title,
         p.duration_days, p.image_url, p.highlights, p.max_persons,
         p.price_per_person, p.tag, p.rating, p.review_count, p.trip_content
  FROM packages p
  JOIN regions r ON r.region_id = p.region_id AND r.is_deleted = false AND r.is_active = true
  JOIN vehicle_types vt ON vt.vehicle_type_id = p.vehicle_type_id AND NOT vt.is_deleted AND vt.is_active
  WHERE p.is_deleted = false AND p.is_active = true AND p.booking_mode IN ('private','both')`;

const PACKAGE_STOPS_SELECT = `
  SELECT ps.package_id, ps.tourist_spot_id, ts.name, ts.tag, ts.description,
         ts.image_url, ps.stop_order, ps.nights_here
  FROM package_stops ps
  JOIN tourist_spots ts ON ts.tourist_spot_id = ps.tourist_spot_id
  WHERE ps.is_deleted = false`;

interface PackageRow {
  trip_content: PackageContent | null;
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

function toPublicPackage(r: PackageRow, stops: PublicPackageStop[], names: Map<number,string>, includePlan = false): PublicPackageDetail {
  let content: PackageContent | null = null, invalid = false;
  try { content = r.trip_content == null ? null : validatePackageContent(r.trip_content); } catch { invalid = true; }
  const isGuided = Boolean(content?.routeTree);
  if (content?.routeTree) content = { ...content, routeTree: availableRouteTree(content.routeTree, new Set(names.keys())) };
  const range = content?.routeTree ? routeRange(content.routeTree, Number(r.price_per_person)) : null;
  return {
    ...(content?.routeTree ? { guidedPlan: { content, basePricePerPerson: Number(r.price_per_person), destinations: content.routeTree.nodes.map(node => ({ id: node.spotId, name: names.get(node.spotId)! })) } } : {}),
    isGuided, isBookable: !invalid && (isGuided ? Boolean(range?.minDays) : stops.every(stop=>names.has(stop.touristSpotId))),
    ...(range ? { durationMaxDays: range.maxDays } : {}),
    tripContent: includePlan ? content : null,
    basePricePerPerson: Number(r.price_per_person),
    routeDestinations: includePlan && content?.routeTree ? content.routeTree.nodes.map(node=>({id:node.spotId,name:names.get(node.spotId)!})) : [],
    id: r.package_id,
    slug: r.slug,
    name: r.name,
    regionId: r.region_id,
    regionName: r.region_name,
    vehicleTypeSlug: r.vehicle_type_slug,
    vehicleTypeTitle: r.vehicle_type_title,
    durationDays: range?.minDays || r.duration_days,
    imageUrl: r.image_url,
    highlights: content ? content.inclusions.slice(0,3) : Array.isArray(r.highlights) ? r.highlights : [],
    maxPersons: r.max_persons,
    pricePerPerson: range?.minDays ? range.minPrice : Number(r.price_per_person),
    tag: r.tag,
    rating: r.rating != null ? Number(r.rating) : null,
    reviewCount: r.review_count,
    destinations: stops.map((s) => s.name),
    destinationIds: Array.from(new Set([...stops.map(stop=>stop.touristSpotId),...(content?.routeTree?.nodes.map(node=>node.spotId)??[])])).filter(id=>names.has(id)),
    stops,
  };
}

/** Adapt a PublicPackage to the `@/types` TravelPackage shape the cards render. */
export function toCardPackage(p: PublicPackage): TravelPackage {
  return {
    guidedPlan: p.guidedPlan,
    regionId: p.regionId,
    destinationIds: p.destinationIds ?? [],
    isGuided: p.isGuided,
    isBookable: p.isBookable,
    durationMaxDays: p.durationMaxDays,
    id: p.slug,
    name: p.name,
    region: p.regionName,
    duration: p.durationDays,
    imageUrl: p.imageUrl ?? PACKAGE_IMAGE_FALLBACK,
    destinations: p.destinations,
    vehicleType: p.vehicleTypeTitle,
    maxPersons: p.maxPersons,
    highlights: p.highlights,
    pricePerPerson: p.pricePerPerson,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount,
    tag: normalizePackageTag(p.tag),
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
  const spotIds = new Set<number>(stops.rows.map(row=>row.tourist_spot_id));
  for(const row of pkgs.rows){ try { const content = row.trip_content == null ? null : validatePackageContent(row.trip_content);content?.routeTree?.nodes.forEach(node=>spotIds.add(node.spotId)); } catch { /* malformed plans are marked unavailable */ } }
  const names = await planSpotNames(pool,Array.from(spotIds));
  return pkgs.rows.map((r) => toPublicPackage(r, byPackage.get(r.package_id) ?? [], names));
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
  let content: PackageContent | null = null; try { content = pkg.rows[0].trip_content == null ? null : validatePackageContent(pkg.rows[0].trip_content); } catch { /* unavailable malformed plan */ }
  const names = await planSpotNames(pool, content?.routeTree?.nodes.map(node=>node.spotId) ?? stops.rows.map(row=>row.tourist_spot_id));
  return toPublicPackage(pkg.rows[0], (stops.rows as StopRow[]).map(toStop), names, true);
}

// ─── Regions (with spots, for the Package Builder) ───────────────────────────

export interface PublicRegionSpot {
  stateName?: string;
  latitude: number | null;
  longitude: number | null;
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

/**
 * Adapt a PublicRegion to the `@/types` Region shape the Package Builder uses
 * (string ids, non-null strings). `Number(spot.id)` recovers the real
 * tourist_spot_id when a custom itinerary is submitted.
 */
export function toBuilderRegion(r: PublicRegion): Region {
  return {
    id: String(r.id),
    name: r.name,
    state: r.state,
    imageUrl: regionPhoto(r),
    spots: r.spots.map((s) => ({
      id: String(s.id),
      name: s.name,
      tag: s.tag ?? "",
      description: s.description ?? "",
      imageUrl: s.imageUrl ?? PACKAGE_IMAGE_FALLBACK,
      cityName: s.cityName, stateName: s.stateName, latitude: s.latitude, longitude: s.longitude,
    })),
  };
}

export async function listPublicRegions(): Promise<PublicRegion[]> {
  const pool = getPool();
  const [regions, spots] = await Promise.all([
    pool.query(
      `SELECT r.region_id,r.name,r.image_url,COALESCE((SELECT string_agg(s.name,' · ' ORDER BY s.name) FROM states s WHERE s.region_id=r.region_id AND NOT s.is_deleted AND s.is_active),'') AS state FROM regions r
        WHERE r.is_deleted = false AND r.is_active = true
        ORDER BY r.display_order, r.region_id`,
    ),
    pool.query(
      `SELECT s.region_id, ts.tourist_spot_id, ts.name, ts.tag, ts.description,
              ts.image_url, ts.city_id, c.name AS city_name, s.name AS state_name, ts.latitude, ts.longitude
         FROM tourist_spots ts
         JOIN cities c ON c.city_id = ts.city_id AND c.is_deleted = false AND c.is_active = true
         JOIN states s ON s.state_id=c.state_id AND NOT s.is_deleted AND s.is_active
         JOIN regions r ON r.region_id=s.region_id AND NOT r.is_deleted AND r.is_active
        WHERE ts.is_deleted = false AND ts.is_active = true AND ts.tag IS DISTINCT FROM $1
        ORDER BY ts.display_order, ts.tourist_spot_id`,
      [ROUTE_STOP_TAG],
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
      stateName: s.state_name,
      latitude: s.latitude == null ? null : Number(s.latitude), longitude: s.longitude == null ? null : Number(s.longitude),
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
