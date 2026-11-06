import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/auth-guard';
import { matchesRequestOrigin } from '@/lib/server/request-origin';
import { readBoundedJsonObject } from '@/lib/server/http-json';
import { cmsOptions, resolveCmsDestination } from '@/lib/server/cms-catalogue';
import { CmsError } from '@/lib/cms';
import { TripError } from '@/lib/weekend-trips';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export async function GET() {
  const auth = await requireRole('admin'); if (!auth.ok) return auth.response;
  try { return NextResponse.json(await cmsOptions(), { headers }); }
  catch { return NextResponse.json({ error: 'Unable to load destinations. Please retry.' }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  const auth = await requireRole('admin'); if (!auth.ok) return auth.response;
  if (!matchesRequestOrigin(request)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403, headers });
  let body;
  try { body = await readBoundedJsonObject(request.body, 4096); } catch { return NextResponse.json({ error: 'Invalid destination.' }, { status: 400, headers }); }
  try { return NextResponse.json({ href: await resolveCmsDestination(body) }, { headers }); }
  catch (e) { return NextResponse.json({ error: e instanceof CmsError || e instanceof TripError ? e.message : 'Unable to check this destination. Please retry.' }, { status: e instanceof CmsError || e instanceof TripError ? e.status : 503, headers }); }
}
