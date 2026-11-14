import { getPool } from "../db";
import { logActivity } from "../activity-log";
import { protectedResourceMutation } from "../weekend-resources";
import { catalogueWrite, assertCatalogueParents, assertCatalogueDelete, isCatalogueTable } from "./_catalogue";
import type { Pool, PoolClient } from "pg";

/**
 * Partial UPDATE from a static camelCase->column map. Only keys present in
 * `input` (and not undefined) are written. Column names come from the caller's
 * hard-coded map, never from the request body. `updated_by` is always set.
 * Reads/writes are scoped to `is_deleted = false`.
 */
export async function applyPartialUpdate(
  table: string,
  idColumn: string,
  id: number,
  input: Record<string, unknown>,
  columnMap: Record<string, string>,
  actorId: string,
): Promise<boolean> {
  const cols: string[] = [];
  const vals: unknown[] = [];
  for (const [key, column] of Object.entries(columnMap)) {
    if (input[key] !== undefined) {
      vals.push(input[key]);
      cols.push(`${column} = $${vals.length}`);
    }
  }
  if (cols.length === 0) return true;

  vals.push(actorId);
  cols.push(`updated_by = $${vals.length}`);
  vals.push(id);

  const result = await catalogueWrite(table, async client => {
    await assertCatalogueParents(client, table, input);
    return protectedResourceMutation(table,id,input,db => db.query(
      `UPDATE ${table} SET ${cols.join(", ")}
       WHERE ${idColumn} = $${vals.length} AND is_deleted = false`,
      vals,
    ), "release" in client ? client as PoolClient : undefined);
  });
  const ok = (result.rowCount ?? 0) > 0;
  if (ok) {
    await logActivity({
      userId: actorId,
      action: "admin.update",
      entityType: table,
      entityId: id,
      details: { fields: Object.keys(columnMap).filter((k) => input[k] !== undefined) },
    });
  }
  return ok;
}

export async function softDelete(
  table: string,
  idColumn: string,
  id: number,
  actorId: string,
): Promise<boolean> {
  const remove = async (db: Pool | PoolClient) => {
    const changed = await db.query(`UPDATE ${table} SET is_deleted=true, updated_by=$1 WHERE ${idColumn}=$2 AND NOT is_deleted`, [actorId,id]);
    if (table === "packages") await db.query("UPDATE package_stops SET is_deleted=true,updated_by=$1 WHERE package_id=$2 AND NOT is_deleted", [actorId,id]);
    return changed;
  };
  const result = isCatalogueTable(table) ? await catalogueWrite(table, async client => {
    const found = await client.query(`SELECT 1 FROM ${table} WHERE ${idColumn}=$1 AND NOT is_deleted FOR UPDATE`, [id]);
    if (!found.rowCount) return { rowCount: 0 };
    await assertCatalogueDelete(client, table, id);
    return protectedResourceMutation(table,id,{isDeleted:true},remove,client as PoolClient);
  }) : await protectedResourceMutation(table,id,{isDeleted:true},remove);
  const ok = (result.rowCount ?? 0) > 0;
  if (ok) {
    await logActivity({
      userId: actorId,
      action: "admin.delete",
      entityType: table,
      entityId: id,
    });
  }
  return ok;
}

/**
 * How many non-deleted rows in `childTable` still point at `parentId` via
 * `fkColumn`. `childTable`/`fkColumn` are always hard-coded by the caller —
 * never taken from a request. Used to stop a soft-delete from silently
 * orphaning child rows under a "deleted" parent.
 */
export async function countActiveChildren(
  childTable: string,
  fkColumn: string,
  parentId: number,
): Promise<number> {
  const result = await getPool().query(
    `SELECT count(*)::int AS n FROM ${childTable}
     WHERE ${fkColumn} = $1 AND is_deleted = false`,
    [parentId],
  );
  return result.rows[0].n as number;
}

/** Plural-aware "1 vehicle" / "3 vehicles" for dependent-row messages. */
export function plural(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
