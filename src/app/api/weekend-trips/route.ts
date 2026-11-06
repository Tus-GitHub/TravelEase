import { listPublicTrips,readTripFilters } from "@/lib/server/weekend-public";
import { tripResponse,tripFailure } from "@/lib/server/weekend-http";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return tripResponse({items:await listPublicTrips(readTripFilters(Object.fromEntries(new URL(request.url).searchParams)))});}catch(error){return tripFailure(error);}}
