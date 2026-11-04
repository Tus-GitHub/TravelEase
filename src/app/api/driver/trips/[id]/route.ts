import { requireRole } from '@/lib/server/auth-guard';
import { listDriverTrips, DriverError } from '@/lib/server/driver';
import { driverResponse } from '@/lib/server/driver-api';
export async function GET(_:Request,{params}:{params:{id:string}}) {
  const a=await requireRole('driver'); if(!a.ok) return a.response;
  return driverResponse(async()=>{
    const trip=(await listDriverTrips(a.user.id,params.id))[0];
    if(!trip) throw new DriverError(404,'Trip not found.');
    return {trip};
  });
}
