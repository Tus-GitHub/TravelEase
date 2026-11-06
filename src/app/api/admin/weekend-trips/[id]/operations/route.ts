import { requireRole } from "@/lib/server/auth-guard";
import { operateDeparture, departureManifest, assignTripRoom } from "@/lib/server/weekend-operations";
import { tripRequest, tripResponse, tripFailure } from "@/lib/server/weekend-http";
export const dynamic = "force-dynamic";
export async function GET(_: Request,{params}:{params:{id:string}}) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  try { return tripResponse(await departureManifest(params.id,auth.user)); } catch (error) { return tripFailure(error); }
}
export async function POST(request: Request,{params}:{params:{id:string}}) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  try { return tripResponse({item:await operateDeparture(params.id,await tripRequest(request),auth.user)}); } catch (error) { return tripFailure(error); }
}
export async function PATCH(request: Request,{params}:{params:{id:string}}) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  try { await assignTripRoom(params.id,await tripRequest(request),auth.user); return tripResponse({ok:true}); } catch (error) { return tripFailure(error); }
}
