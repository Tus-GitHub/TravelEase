/**
 * Classifiers for Postgres error conditions, keyed on the stable SQLSTATE
 * `code` that node-postgres puts on the thrown error — never on the human
 * message text (which is locale-dependent and can change between PG versions).
 *
 * Route handlers use these to turn a raw driver error into a deliberate 400/409
 * instead of a 500. See `src/lib/server/api-errors.ts` for the HTTP mapping.
 */

function pgCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/** 23505 — a UNIQUE (or primary key) constraint was violated. */
export function isUniqueViolation(err: unknown): boolean {
  return pgCode(err) === "23505";
}

/** 23503 — a FOREIGN KEY constraint was violated (parent row missing, or child rows block a delete). */
export function isForeignKeyViolation(err: unknown): boolean {
  return pgCode(err) === "23503";
}

/** 23502 — a NOT NULL column was given no value. */
export function isNotNullViolation(err: unknown): boolean {
  return pgCode(err) === "23502";
}

/** 23514 — a CHECK constraint failed. */
export function isCheckViolation(err: unknown): boolean {
  return pgCode(err) === "23514";
}

/** 22P02 — a value could not be parsed into its column type (e.g. a non-UUID string in a uuid filter). */
export function isInvalidTextRepresentation(err: unknown): boolean {
  return pgCode(err) === "22P02";
}

/** 22003 — a numeric value is outside the range its column allows. */
export function isNumericRangeError(err: unknown): boolean {
  return pgCode(err) === "22003";
}

/**
 * Thrown by the admin delete helpers when a row still has active children that
 * a soft-delete would silently orphan (e.g. deleting a region that still has
 * cities). Routes map this to HTTP 409.
 */
export class DependentRowsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DependentRowsError";
  }
}
