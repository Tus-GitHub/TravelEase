import type { PoolClient } from "pg";
import { getPool } from "../db";
import { ImageError } from "../cloudinary";
import type { AdminImage, ImageKind } from "../../image-upload";
import { markUploadRolledBack } from "../upload-persistence";
import { vehicleCropUrl, validVehicleCrop } from "../../vehicle-image";

// Identifiers are exclusively server-owned, never interpolated from request input.
const tables = {
  drivers: ["drivers", "driver_id"], vehicles: ["vehicles", "vehicle_id"],
  packages: ["packages", "package_id"], regions: ["regions", "region_id"],
  "tourist-spots": ["tourist_spots", "tourist_spot_id"],
} as const;

export async function listImages(kind: ImageKind, id: number): Promise<AdminImage[]> {
  const [table, pk] = tables[kind];
  const row = (await getPool().query(`SELECT ${kind === "vehicles" ? pk : "image_url"} FROM ${table} WHERE ${pk}=$1 AND NOT is_deleted`, [id])).rows[0];
  if (!row) throw new ImageError("Record not found.", 404);
  if (kind !== "vehicles") return row.image_url ? [{ id, url: row.image_url, primary: true }] : [];
  return (await getPool().query(`SELECT vehicle_image_id AS id, image_url AS url, is_primary AS "primary"
    FROM vehicle_images WHERE vehicle_id=$1 AND NOT is_deleted AND is_active ORDER BY is_primary DESC, display_order, vehicle_image_id`, [id])).rows;
}

async function locked<T>(kind: ImageKind, id: number, fn: (c: PoolClient) => Promise<T>) {
  const c = await getPool().connect();
  let commitAttempted = false;
  try {
    await c.query("BEGIN");
    const [table, pk] = tables[kind];
    const row = await c.query(`SELECT ${pk} FROM ${table} WHERE ${pk}=$1 AND NOT is_deleted FOR UPDATE`, [id]);
    if (!row.rowCount) throw new ImageError("Record not found.", 404);
    const result = await fn(c);
    commitAttempted = true;
    await c.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await c.query("ROLLBACK");
      if (!commitAttempted) markUploadRolledBack(err);
    } catch { /* Unknown outcome: retain the asset and the original error. */ }
    throw err;
  }
  finally { c.release(); }
}

export async function saveImage(kind: ImageKind, id: number, url: string, actor: string) {
  if (!url.startsWith("https://res.cloudinary.com/") || url.length > 500) throw new ImageError("Invalid image URL.");
  await locked(kind, id, async (c) => {
    if (kind === "vehicles") {
      const { rows } = await c.query("SELECT count(*)::int AS count FROM vehicle_images WHERE vehicle_id=$1 AND NOT is_deleted AND is_active", [id]);
      if (rows[0].count >= 10) throw new ImageError("A vehicle can have up to 10 images.");
      await c.query(`INSERT INTO vehicle_images (vehicle_id,image_url,is_primary,created_by,updated_by)
        VALUES ($1,$2,$3,$4,$4)`, [id, url, rows[0].count === 0, actor]);
    } else {
      const [table, pk] = tables[kind];
      await c.query(`UPDATE ${table} SET image_url=$2, updated_by=$3 WHERE ${pk}=$1`, [id, url, actor]);
    }
  });
}

export async function changeImage(kind: ImageKind, id: number, imageId: number, action: "remove" | "primary", actor: string) {
  await locked(kind, id, async (c) => {
    if (kind !== "vehicles") {
      if (action !== "remove" || imageId !== id) throw new ImageError("Invalid image action.");
      const [table, pk] = tables[kind];
      await c.query(`UPDATE ${table} SET image_url=NULL, updated_by=$2 WHERE ${pk}=$1`, [id, actor]);
      return;
    }
    const found = await c.query("SELECT vehicle_image_id FROM vehicle_images WHERE vehicle_id=$1 AND vehicle_image_id=$2 AND NOT is_deleted AND is_active", [id, imageId]);
    if (!found.rowCount) throw new ImageError("Image not found.", 404);
    if (action === "primary") {
      await c.query("UPDATE vehicle_images SET is_primary=(vehicle_image_id=$2), updated_by=$3 WHERE vehicle_id=$1 AND NOT is_deleted AND is_active", [id, imageId, actor]);
    } else {
      await c.query("UPDATE vehicle_images SET is_deleted=true, is_primary=false, updated_by=$3 WHERE vehicle_id=$1 AND vehicle_image_id=$2", [id, imageId, actor]);
      await c.query(`UPDATE vehicle_images SET is_primary=true, updated_by=$2 WHERE vehicle_image_id=(
        SELECT vehicle_image_id FROM vehicle_images WHERE vehicle_id=$1 AND NOT is_deleted AND is_active
        ORDER BY is_primary DESC, display_order, vehicle_image_id LIMIT 1)`, [id, actor]);
    }
  });
}

/** Update only this existing photo's delivery URL; preserve the original asset and primary choice. */
export async function cropVehicleImage(id: number, imageId: number, expectedUrl: unknown, crop: unknown, actor: string) {
  if (typeof expectedUrl !== "string" || expectedUrl.length > 500 || (crop !== null && !validVehicleCrop(crop))) throw new ImageError("Invalid photo frame.");
  await locked("vehicles", id, async c => {
    const found = await c.query("SELECT image_url FROM vehicle_images WHERE vehicle_id=$1 AND vehicle_image_id=$2 AND NOT is_deleted AND is_active FOR UPDATE", [id, imageId]);
    if (!found.rowCount) throw new ImageError("Image not found.", 404);
    if (found.rows[0].image_url !== expectedUrl) throw new ImageError("This photo changed in another editor. Close and reload photos before saving.", 409);
    const url = vehicleCropUrl(found.rows[0].image_url, crop);
    if (!url || url.length > 500) throw new ImageError("Upload this photo through the gallery before cropping it.");
    await c.query("UPDATE vehicle_images SET image_url=$3,updated_by=$4 WHERE vehicle_id=$1 AND vehicle_image_id=$2", [id, imageId, url, actor]);
  });
}
