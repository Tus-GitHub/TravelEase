import {NextResponse} from 'next/server';
import {optionalUser} from '@/lib/server/auth-guard';
import {sendRouteEnquiry} from '@/lib/server/route-templates';
import {matchesRequestOrigin} from '@/lib/server/request-origin';
import {readBoundedJsonObject} from '@/lib/server/http-json';
import {clientIp} from '@/lib/server/activity-log';
import {checkRateLimit} from '@/lib/server/rate-limit';
import {TripError} from '@/lib/weekend-trips';
export async function POST(request:Request){if(!matchesRequestOrigin(request))return NextResponse.json({error:'Invalid origin.'},{status:403});const user=await optionalUser();if(!user){const ip=clientIp(request)??'unknown';const rl=checkRateLimit(`route-enquiry:${ip}`,5,15*60_000);if(!rl.ok)return rl.response;}try{const input=await readBoundedJsonObject(request.body,12*1024);const result=await sendRouteEnquiry(user,input);if(!result.ok)return NextResponse.json({error:result.message},{status:result.status});return NextResponse.json({ticket:result.ticket},{status:201});}catch(e){if(e instanceof TripError)return NextResponse.json({error:e.message},{status:e.status});throw e;}}
