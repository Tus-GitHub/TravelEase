import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/server/site-settings";

// Must reflect admin edits, so never statically cached at build time. The
// `getSiteSettings()` in-memory cache (60s) keeps the DB load down.
export const dynamic = "force-dynamic";

/** Public — the resolved contact block, for client components (footer, etc.). */
export async function GET() {
  const settings = await getSiteSettings();
  return NextResponse.json(
    { contact: settings.contact },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
