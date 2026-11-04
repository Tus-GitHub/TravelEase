import { requireRole } from '@/lib/server/auth-guard';
import { createDriverLogin,removeDriverLogin,DriverError } from '@/lib/server/driver';
import { driverResponse,driverBody } from '@/lib/server/driver-api';
function driverId(id:string) { const n=Number(id); if(!Number.isSafeInteger(n)||n<1) throw new DriverError(400,'Invalid driver.'); return n; }
export async function POST(request:Request,{params}:{params:{id:string}}) {
  const a=await requireRole('admin'); if(!a.ok) return a.response;
  return driverResponse(async()=>{
    const b=await driverBody(request);
    if(typeof b.email!=='string'||typeof b.password!=='string') throw new DriverError(400,'Email and password required.');
    await createDriverLogin(driverId(params.id),b.email,b.password,a.user.id); return {ok:true};
  });
}
export async function DELETE(_:Request,{params}:{params:{id:string}}) {
  const a=await requireRole('admin'); if(!a.ok) return a.response;
  return driverResponse(async()=>{await removeDriverLogin(driverId(params.id),a.user.id); return {ok:true};});
}
