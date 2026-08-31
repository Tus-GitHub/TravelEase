import { getPool } from "../db";
import { applyPartialUpdate, softDelete } from "./_util";

export interface PackageStop {
  id: number;
  touristSpotId: number;
  touristSpotName: string;
  stopOrder: number;
  nightsHere: number;
}

export interface CataloguePackage {
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
         p.tag, p.rating, p.is_active
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

async function getPackage(id: number): Promise<CataloguePackage | null> {
  const pool = getPool();
  const [pkg, stops] = await Promise.all([
    pool.query(`${P_SELECT} WHERE p.package_id = $1 AND p.is_deleted = false`, [id]),
    pool.query(
      `${STOP_SELECT} WHERE ps.package_id = $1 AND ps.is_deleted = false ORDER BY ps.stop_order`,
      [id],
    ),
  ]);
  if (!pkg.rows[0]) return null;
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
  const slug = await uniqueSlug(slugify(input.name));
  const result = await getPool().query(
    `INSERT INTO packages
       (region_id, vehicle_type_id, name, slug, duration_days, max_persons,
        price_per_person, tag, rating, highlights, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '[]'::jsonb, $10, $10)
     RETURNING package_id`,
    [
      input.regionId,
      input.vehicleTypeId,
      input.name,
      slug,
      input.durationDays,
      input.maxPersons,
      input.pricePerPerson,
      input.tag || null,
      input.rating,
      actorId,
    ],
  );
  return (await getPackage(result.rows[0].package_id))!;
}

export async function updatePackage(
  id: number,
  input: Partial<PackageInput & { isActive: boolean }>,
  actorId: string,
): Promise<CataloguePackage | null> {
  const ok = await applyPartialUpdate(
    "packages",
    "package_id",
    id,
    input,
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
    },
    actorId,
  );
  return ok ? getPackage(id) : null;
}

export function deletePackage(id: number, actorId: string): Promise<boolean> {
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
  await getPool().query(
    `INSERT INTO package_stops
       (package_id, tourist_spot_id, stop_order, nights_here, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [packageId, input.touristSpotId, input.stopOrder, input.nightsHere, actorId],
  );
  return getPackage(packageId);
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
