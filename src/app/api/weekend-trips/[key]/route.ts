import { getPublicTrip } from "@/lib/server/weekend-public";
import { tripResponse,tripFailure } from "@/lib/server/weekend-http";
export const dynamic="force-dynamic";
export async function GET(_:Request,{params}:{params:{key:string}}){try{const item=await getPublicTrip(params.key);return item?tripResponse({item}):tripResponse({error:"Trip not found."},404);}catch(error){return tripFailure(error);}}
