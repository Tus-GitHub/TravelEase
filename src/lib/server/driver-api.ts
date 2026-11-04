import { NextResponse } from 'next/server';
import { DriverError } from './driver';
export async function driverResponse(fn: () => Promise<unknown>) {
  try { return NextResponse.json(await fn(), {headers:{'Cache-Control':'no-store'}}); }
  catch (e) {
    if (e instanceof DriverError) return NextResponse.json({error:e.message},{status:e.status});
    console.error('Driver request failed');
    return NextResponse.json({error:'Unable to complete request.'},{status:500});
  }
}
export async function driverBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error();
    return b;
  } catch { throw new DriverError(400,'Invalid request body.'); }
}
