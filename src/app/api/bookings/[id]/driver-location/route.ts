import { requireUser } from '@/lib/server/auth-guard';
import { latestLocation } from '@/lib/server/driver';
import { driverResponse } from '@/lib/server/driver-api';
export async function GET(_:Request,{params}:{params:{id:string}}) {
  const a=await requireUser(); if(!a.ok) return a.response;
  return driverResponse(async()=>({location:await latestLocation(params.id,a.user.id)}));
}
