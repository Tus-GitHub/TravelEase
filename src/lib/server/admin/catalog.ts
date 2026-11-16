import type { Pool, PoolClient } from "pg";
import { catalogueWrite, assertCatalogueParents } from "./_catalogue";
import { getPool } from "../db";
import { applyPartialUpdate, softDelete } from "./_util";
import { validatePackageContent, packagePlanDays, type PackageContent } from "../../package-content";
import { TripError } from "../../weekend-trips";
import { assertPlanDestinations } from "../package-plan";

export interface PackageStop {
  id: number;
  touristSpotId: number;
  touristSpotName: string;
  stopOrder: number;
  nightsHere: number;
}

export interface CataloguePackage {
  tripContent: PackageContent | null;
  bookingMode: "private" | "shared" | "both";
  id: number;
  regionId: number;
  regionName: string;
  vehicleTypeId: number;
  vehicleTypeTitle: string;
  name: string;
  slug: string;
  durationDays: number;
  maxPersons: number;
  pricePerPerson: number;
  tag: string;
  rating: number | null;
  isActive: boolean;
  stops: PackageStop[];
}

interface PackageRow {
  trip_content: PackageContent | null;
  booking_mode: "private" | "shared" | "both";
  package_id: number;
  region_id: number;
  region_name: string;
  vehicle_type_id: number;
  vehicle_type_title: string;
  name: string;
  slug: string;
  duration_days: number;
  max_persons: number;
  price_per_person: string;
  tag: string | null;
  rating: string | null;
  is_active: boolean;
}

function toPackage(r: PackageRow, stops: PackageStop[]): CataloguePackage {
  return {
    tripContent: r.trip_content,
    bookingMode: r.booking_mode,
    id: r.package_id,
    regionId: r.region_id,
    regionName: r.region_name,
    vehicleTypeId: r.vehicle_type_id,
    vehicleTypeTitle: r.vehicle_type_title,
    name: r.name,
    slug: r.slug,
    durationDays: r.duration_days,
    maxPersons: r.max_persons,
    pricePerPerson: Number(r.price_per_person),
    tag: r.tag ?? "",
    rating: r.rating != null ? Number(r.rating) : null,
    isActive: r.is_active,
    stops,
  };
}

const P_SELECT = `
  SELECT p.package_id, p.region_id, r.name AS region_name,
         p.vehicle_type_id, vt.title AS vehicle_type_title,
         p.name, p.slug, p.duration_days, p.max_persons, p.price_per_person,
         p.tag, p.rating, p.is_active, p.booking_mode, p.trip_content
  FROM packages p
  JOIN regions r ON r.region_id = p.region_id
  JOIN vehicle_types vt ON vt.vehicle_type_id = p.vehicle_type_id
`;

const STOP_SELECT = `
  SELECT ps.package_stop_id, ps.package_id, ps.tourist_spot_id,
         ts.name AS tourist_spot_name, ps.stop_order, ps.nights_here
  FROM package_stops ps
  JOIN tourist_spots ts ON ts.tourist_spot_id = ps.tourist_spot_id
`;

function toStop(r: {
  package_stop_id: number;
  tourist_spot_id: number;
  tourist_spot_name: string;
  stop_order: number;
  nights_here: number;
}): PackageStop {
  return {
    id: r.package_stop_id,
    touristSpotId: r.tourist_spot_id,
    touristSpotName: r.tourist_spot_name,
    stopOrder: r.stop_order,
    nightsHere: r.nights_here,
  };
}

export async function listPackages(): Promise<CataloguePackage[]> {
  const pool = getPool();
  const [pkgs, stops] = await Promise.all([
    pool.query(`${P_SELECT} WHERE p.is_deleted = false ORDER BY p.display_order, p.package_id`),
    pool.query(`${STOP_SELECT} WHERE ps.is_deleted = false ORDER BY ps.stop_order`),
  ]);
  const byPackage = new Map<number, PackageStop[]>();
  for (const row of stops.rows) {
    const list = byPackage.get(row.package_id) ?? [];
    list.push(toStop(row));
    byPackage.set(row.package_id, list);
  }
  return pkgs.rows.map((r) => toPackage(r, byPackage.get(r.package_id) ?? []));
}

async function getPackage(id: number, client?: Pool | PoolClient): Promise<CataloguePackage | null> {
  const pool = client ?? getPool();
  const pkg = await pool.query(`${P_SELECT} WHERE p.package_id = $1 AND p.is_deleted = false`, [id]);
  if (!pkg.rows[0]) return null;
  const stops = await pool.query(
      `${STOP_SELECT} WHERE ps.package_id = $1 AND ps.is_deleted = false ORDER BY ps.stop_order`,
      [id],
  );
  return toPackage(pkg.rows[0], stops.rows.map(toStop));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const pool = getPool();
  let slug = base || "package";
  for (let i = 2; ; i++) {
    const hit = await pool.query("SELECT 1 FROM packages WHERE slug = $1", [slug]);
    if (hit.rowCount === 0) return slug;
    slug = `${base}-${i}`;
  }
}

export interface PackageInput {
  isActive?: boolean;
  tripContent?: PackageContent | null;
  bookingMode?: "private" | "shared" | "both";
  regionId: number;
  vehicleTypeId: number;
  name: string;
  durationDays: number;
  maxPersons: number;
  pricePerPerson: number;
  tag: string;
  rating: number | null;
}

export async function createPackage(
  input: PackageInput,
  actorId: string,
): Promise<CataloguePackage> {
  const tripContent = input.tripContent == null ? null : validatePackageContent(input.tripContent);
  const durationDays = packagePlanDays(tripContent, input.bookingMode ?? "private", input.pricePerPerson, input.durationDays);
  if (tripContent && input.bookingMode !== "shared" && (input.isActive ?? true) && !(input.pricePerPerson > 0)) throw new TripError("Set a positive per-person price before making this package live.");
  const slug = await uniqueSlug(slugify(input.name));
  return catalogueWrite("packages", async db => {
    await assertCatalogueParents(db, "packages", { ...input });
    if (input.isActive ?? true) await assertPlanDestinations(db, tripContent);
    const result = await db.query(
      `INSERT INTO packages
         (region_id, vehicle_type_id, name, slug, duration_days, max_persons,
          price_per_person, tag, rating, highlights, created_by, updated_by, booking_mode, trip_content, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '[]'::jsonb, $10, $10, $11, $12::jsonb, $13)
       RETURNING package_id`,
      [
        input.regionId,
        input.vehicleTypeId,
        input.name,
        slug,
        durationDays,
        input.maxPersons,
        input.pricePerPerson,
        input.tag || null,
        input.rating,
        actorId,
        input.bookingMode ?? "private",
        tripContent,
        input.isActive ?? true,
      ],
    );
    return (await getPackage(result.rows[0].package_id, db))!;
  });
}

export async function updatePackage(
  id: number,
  input: Partial<PackageInput & { isActive: boolean }>,
  actorId: string,
): Promise<CataloguePackage | null> {
  const current = await getPackage(id);
  if (!current) return null;
  const patch = { ...input };
  if (input.tripContent !== undefined) patch.tripContent = validatePackageContent(input.tripContent);
  const content = patch.tripContent === undefined ? current.tripContent : patch.tripContent;
  if (content) patch.durationDays = packagePlanDays(content, patch.bookingMode ?? current.bookingMode, patch.pricePerPerson ?? current.pricePerPerson, patch.durationDays ?? current.durationDays);
  const ok = await applyPartialUpdate(
    "packages",
    "package_id",
    id,
    patch,
    {
      regionId: "region_id",
      vehicleTypeId: "vehicle_type_id",
      name: "name",
      durationDays: "duration_days",
      maxPersons: "max_persons",
      pricePerPerson: "price_per_person",
      tag: "tag",
      rating: "rating",
      isActive: "is_active",
      bookingMode: "booking_mode",
      tripContent: "trip_content",
    },
    actorId,
    async db => {
      const row = (await db.query("SELECT booking_mode,price_per_person,duration_days,trip_content,is_active FROM packages WHERE package_id=$1 AND NOT is_deleted FOR UPDATE", [id])).rows[0];
      if (!row) return;
      const saved = patch.tripContent === undefined ? row.trip_content == null ? null : validatePackageContent(row.trip_content) : patch.tripContent;
      const mode = patch.bookingMode ?? row.booking_mode, price = patch.pricePerPerson ?? Number(row.price_per_person), days = patch.durationDays ?? row.duration_days;
      if (saved && packagePlanDays(saved, mode, price, days) !== days) throw new TripError("The package plan changed. Reload it before saving.", 409);
      if (saved && mode !== "shared" && (patch.isActive ?? row.is_active) && !(price > 0)) throw new TripError("Set a positive per-person price before making this package live.");
      if (patch.isActive ?? row.is_active) await assertPlanDestinations(db, saved);
    },
  );
  return ok ? getPackage(id) : null;
}

export async function deletePackage(id: number, actorId: string): Promise<boolean> {
  return softDelete("packages", "package_id", id, actorId);
}

// ─── Package stops ─────────────────────────────────────────────────────────────

export interface PackageStopInput {
  touristSpotId: number;
  stopOrder: number;
  nightsHere: number;
}

export async function addPackageStop(
  packageId: number,
  input: PackageStopInput,
  actorId: string,
): Promise<CataloguePackage | null> {
  return catalogueWrite("package_stops", async db => {
    const pkg = await getPackage(packageId, db);
    if (!pkg) return null;
    await assertCatalogueParents(db, "package_stops", { packageId, ...input });
    await db.query(
      `INSERT INTO package_stops (package_id,tourist_spot_id,stop_order,nights_here,created_by,updated_by)
       VALUES($1,$2,$3,$4,$5,$5)`, [packageId,input.touristSpotId,input.stopOrder,input.nightsHere,actorId],
    );
    return getPackage(packageId, db);
  });
}

export async function deletePackageStop(
  stopId: number,
  actorId: string,
): Promise<{ packageId: number } | null> {
  const pool = getPool();
  const found = await pool.query(
    "SELECT package_id FROM package_stops WHERE package_stop_id = $1 AND is_deleted = false",
    [stopId],
  );
  if (!found.rows[0]) return null;
  await softDelete("package_stops", "package_stop_id", stopId, actorId);
  return { packageId: found.rows[0].package_id };
}
