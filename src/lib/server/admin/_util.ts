import { getPool } from "../db";

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

  const result = await getPool().query(
    `UPDATE ${table} SET ${cols.join(", ")}
     WHERE ${idColumn} = $${vals.length} AND is_deleted = false`,
    vals,
  );
  return (result.rowCount ?? 0) > 0;
}

export async function softDelete(
  table: string,
  idColumn: string,
  id: number,
  actorId: string,
): Promise<boolean> {
  const result = await getPool().query(
    `UPDATE ${table} SET is_deleted = true, updated_by = $1
     WHERE ${idColumn} = $2 AND is_deleted = false`,
    [actorId, id],
  );
  return (result.rowCount ?? 0) > 0;
}
