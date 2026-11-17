import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/server/auth-guard';
import {sendRouteEnquiry} from '@/lib/server/route-templates';
import {matchesRequestOrigin} from '@/lib/server/request-origin';
import {readBoundedJsonObject} from '@/lib/server/http-json';
import {TripError} from '@/lib/weekend-trips';
export async function POST(request:Request){const auth=await requireUser();if(!auth.ok)return auth.response;if(!matchesRequestOrigin(request))return NextResponse.json({error:'Invalid origin.'},{status:403});try{const input=await readBoundedJsonObject(request.body,12*1024);const result=await sendRouteEnquiry(auth.user,input);if(!result.ok)return NextResponse.json({error:result.message},{status:result.status});return NextResponse.json({ticket:result.ticket},{status:201});}catch(e){if(e instanceof TripError)return NextResponse.json({error:e.message},{status:e.status});throw e;}}
