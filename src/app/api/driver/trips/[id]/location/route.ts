import { requireRole } from '@/lib/server/auth-guard';
import { recordLocation } from '@/lib/server/driver';
import { driverResponse, driverBody } from '@/lib/server/driver-api';
export async function POST(request:Request,{params}:{params:{id:string}}) {
  const a=await requireRole('driver'); if(!a.ok) return a.response;
  return driverResponse(async()=>{
    await recordLocation(params.id,a.user.id,await driverBody(request)); return {ok:true};
  });
}
