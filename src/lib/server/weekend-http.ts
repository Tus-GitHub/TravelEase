import { NextResponse } from "next/server";
import { matchesRequestOrigin } from "./request-origin";
import { readBoundedJsonObject } from "./http-json";
import { dbErrorResponse } from "./api-errors";
import { TripError } from "@/lib/weekend-trips";
export async function tripRequest(request: Request) {
  if (!matchesRequestOrigin(request)) throw new TripError("Invalid origin.", 403);
  try { return await readBoundedJsonObject(request.body, 160 * 1024); }
  catch { throw new TripError("Check the trip form. The request must be a JSON object under 160 KB."); }
}
export function tripResponse(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
export function tripFailure(error: unknown) {
  if (error instanceof TripError) return tripResponse({ error: error.message }, error.status);
  const known = dbErrorResponse(error, { unique: "That trip address or request already exists.", fk: "A selected record is no longer available. Reload the form." });
  if (known) return known;
  console.error("Weekend trip operation failed");
  return tripResponse({ error: "Unable to confirm this change. Reload the saved trip before retrying." }, 500);
}
