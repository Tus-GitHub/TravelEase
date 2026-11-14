import { NextResponse } from "next/server";
import { resolveRouteLocations } from "@/lib/server/route-stops";
import { requireUser } from "@/lib/server/auth-guard";
import { getRoadMatrix, RoutingError } from "@/lib/server/road-matrix";
import { optimizeStopOrder, validateStopIds } from "@/lib/route-optimization";
import { matchesRequestOrigin } from "@/lib/server/request-origin";

export async function POST(request: Request) {
  // Session-gated like geocoding; guests can still order and book trips manually.
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!matchesRequestOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let ids: number[];
  try {
    // Bound the stream as well as Content-Length; never accept arbitrary coordinates/URLs.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Choose tourist spots first.");
    let bytes = 0; let raw = ""; const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 1024) { await reader.cancel(); throw new Error("Route request is too large."); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    ids = validateStopIds(JSON.parse(raw)?.spotIds);
  } catch { return NextResponse.json({ error: "Choose 2 to 5 distinct tourist spots." }, { status: 400 }); }

  try {
    const matrix = await getRoadMatrix(await resolveRouteLocations(ids));
    let suggestion;
    try { suggestion = optimizeStopOrder(ids, matrix); }
    catch { return NextResponse.json({ error: "These stops could not be connected by road. Your route has not changed." }, { status: 422 }); }
    return NextResponse.json({ suggestion }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RoutingError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Route suggestions are temporarily unavailable." }, { status: 503 });
  }
}
