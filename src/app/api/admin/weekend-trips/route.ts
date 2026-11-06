import { requireRole } from "@/lib/server/auth-guard";
import { listAdminDepartures, saveDeparture, tripOptions } from "@/lib/server/weekend-trips";
import { tripRequest, tripResponse, tripFailure } from "@/lib/server/weekend-http";
export const dynamic = "force-dynamic";
export async function GET() { const auth = await requireRole("admin"); if (!auth.ok) return auth.response; try { return tripResponse({ items: await listAdminDepartures(), options: await tripOptions() }); } catch (error) { return tripFailure(error); } }
export async function POST(request: Request) { const auth = await requireRole("admin"); if (!auth.ok) return auth.response; try { return tripResponse({ item: await saveDeparture(await tripRequest(request), auth.user.id) }, 201); } catch (error) { return tripFailure(error); } }
