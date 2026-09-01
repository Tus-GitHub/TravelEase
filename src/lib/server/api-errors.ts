import { NextResponse } from "next/server";
import {
  DependentRowsError,
  isForeignKeyViolation,
  isUniqueViolation,
} from "./db-errors";

/**
 * Turn a database-layer error into a deliberate HTTP response, or return `null`
 * if it isn't one we recognise (the caller should then `throw err` and let the
 * framework 500 it).
 *
 *   try {
 *     const item = await createCity(input, actor);
 *     return NextResponse.json({ item }, { status: 201 });
 *   } catch (err) {
 *     const res = dbErrorResponse(err, { fk: "That region doesn't exist." });
 *     if (res) return res;
 *     throw err;
 *   }
 */
export function dbErrorResponse(
  err: unknown,
  messages: { fk?: string; unique?: string } = {},
): NextResponse | null {
  if (err instanceof DependentRowsError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (isUniqueViolation(err)) {
    return NextResponse.json(
      { error: messages.unique ?? "That value is already in use." },
      { status: 409 },
    );
  }
  if (isForeignKeyViolation(err)) {
    return NextResponse.json(
      { error: messages.fk ?? "A referenced record doesn't exist." },
      { status: 400 },
    );
  }
  return null;
}
