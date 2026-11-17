import {NextResponse} from 'next/server';
import {listRouteTemplates} from '@/lib/server/route-templates';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({routes:await listRouteTemplates(true)});}
