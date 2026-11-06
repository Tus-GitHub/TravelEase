import { requireRole } from "@/lib/server/auth-guard";
import { saveGuide } from "@/lib/server/weekend-trips";
import { tripNumber } from "@/lib/weekend-trips";
import { tripRequest, tripResponse, tripFailure } from "@/lib/server/weekend-http";
export async function PATCH(request: Request, { params }: { params: { id: string } }) { const auth = await requireRole("admin"); if (!auth.ok) return auth.response; try { const id = tripNumber(Number(params.id), "Guide", 1, 2147483647); return tripResponse({ item: await saveGuide(await tripRequest(request), auth.user.id, id) }); } catch (error) { return tripFailure(error); } }
