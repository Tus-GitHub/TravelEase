import { requireRole } from '@/lib/server/auth-guard';
import { listDriverTrips } from '@/lib/server/driver';
import { driverResponse } from '@/lib/server/driver-api';
export async function GET() {
  const a=await requireRole('driver'); if(!a.ok) return a.response;
  return driverResponse(async()=>({trips:await listDriverTrips(a.user.id)}));
}
