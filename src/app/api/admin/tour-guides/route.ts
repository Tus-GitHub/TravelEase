import { requireRole } from "@/lib/server/auth-guard";
import { listGuides, saveGuide } from "@/lib/server/weekend-trips";
import { tripRequest, tripResponse, tripFailure } from "@/lib/server/weekend-http";
export const dynamic = "force-dynamic";
export async function GET() { const auth = await requireRole("admin"); if (!auth.ok) return auth.response; try { return tripResponse({ items: await listGuides() }); } catch (error) { return tripFailure(error); } }
export async function POST(request: Request) { const auth = await requireRole("admin"); if (!auth.ok) return auth.response; try { return tripResponse({ item: await saveGuide(await tripRequest(request), auth.user.id) }, 201); } catch (error) { return tripFailure(error); } }
