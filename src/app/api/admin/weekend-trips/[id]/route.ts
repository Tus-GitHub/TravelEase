import { requireRole } from "@/lib/server/auth-guard";
import { getAdminDeparture, saveDeparture } from "@/lib/server/weekend-trips";
import { tripRequest, tripResponse, tripFailure } from "@/lib/server/weekend-http";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: { id: string } }) { const auth = await requireRole("admin"); if (!auth.ok) return auth.response; try { return tripResponse({ item: await getAdminDeparture(params.id) }); } catch (error) { return tripFailure(error); } }
export async function PATCH(request: Request, { params }: { params: { id: string } }) { const auth = await requireRole("admin"); if (!auth.ok) return auth.response; try { const body = await tripRequest(request); return tripResponse({ item: await saveDeparture(body, auth.user.id, params.id, body.version) }); } catch (error) { return tripFailure(error); } }
