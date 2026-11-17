import {NextResponse} from 'next/server';
import {requireRole} from '@/lib/server/auth-guard';
import {listRouteTemplates,saveRouteTemplate} from '@/lib/server/route-templates';
import {matchesRequestOrigin} from '@/lib/server/request-origin';
import {readBoundedJsonObject} from '@/lib/server/http-json';
import {TripError} from '@/lib/weekend-trips';
export async function GET(){const auth=await requireRole('admin');if(!auth.ok)return auth.response;return NextResponse.json({items:await listRouteTemplates()});}
export async function POST(request:Request){const auth=await requireRole('admin');if(!auth.ok)return auth.response;if(!matchesRequestOrigin(request))return NextResponse.json({error:'Invalid origin.'},{status:403});try{const input=await readBoundedJsonObject(request.body,64*1024);return NextResponse.json({item:await saveRouteTemplate(input,auth.user.id)});}catch(e){if(e instanceof TripError)return NextResponse.json({error:e.message},{status:e.status});throw e;}}
