/** Development-only real transactions/locks with mocked Cloudinary. No DDL,
 * production writes, external uploads, deletion requests or messages. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import pg from "pg";
import ts from "typescript";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";
import { getPool } from "../../src/lib/server/db.ts";
import * as images from "../../src/lib/server/admin/images.ts";
import * as reviews from "../../src/lib/server/reviews.ts";
import * as vendors from "../../src/lib/server/admin/vendors.ts";
import * as cloudinary from "../../src/lib/server/cloudinary.ts";
import * as persistence from "../../src/lib/server/upload-persistence.ts";
import * as cmsModel from "../../src/lib/cms.ts";
import * as activity from "../../src/lib/server/activity-log.ts";
import * as dbErrors from "../../src/lib/server/db-errors.ts";
import { getSiteSettings, invalidateSiteSettings } from "../../src/lib/server/site-settings.ts";

assert(process.argv.includes("--dev") && !process.env.VERCEL && process.env.VERCEL_ENV !== "production");
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
const host = (s: string) => new URL(s).hostname.replace(/-pooler\./, ".");
const owner = process.env.DATABASE_URL!, runtime = process.env.DATABASE_URL_APP || owner;
assert(owner && process.env.DATABASE_URL_PRODUCTION); assert.equal(host(owner), host(runtime));
assert.notEqual(host(owner), host(process.env.DATABASE_URL_PRODUCTION));
const tag = `content-races-${randomUUID()}`;
// Controlled lock contention needs time to observe both queued operations on
// a cold remote database, including while a release build uses this machine.
const testWaits = { lock_timeout: 15000, statement_timeout: 30000, idle_in_transaction_session_timeout: 45000 };
const pool = new pg.Pool({ ...runtimeDatabaseConfig(owner), ...testWaits, max: 5, application_name: `${tag}-fixtures` });
const app = new pg.Pool({ ...runtimeDatabaseConfig(runtime), ...testWaits, max: 8, application_name: tag });
const globalDb = globalThis as unknown as { __pgPool: pg.Pool }; globalDb.__pgPool = app;
const admin = randomUUID(), customer = randomUUID(), stranger = randomUUID(), userIds = [admin, customer, stranger];
const bookingIds: string[] = [], vehicleIds: number[] = [], vendorIds: number[] = [], pageIds: string[] = [];
let typeId = 0, regionId = 0, bookingType = 0, checks = 0, month = "", otherMonth = "";
const pass = (s: string) => { checks++; console.log(`PASS ${s}`); };
const require = createRequire(import.meta.url);
function load(file: string, aliases: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }; // Route boundary only; production models stay real.
  new Function("require", "module", "exports", code)((id: string) => aliases[id] ?? require(id), mod, mod.exports);
  return mod.exports;
}
// React18's standalone Node entry has no RSC cache; it is irrelevant to writes.
const cms = load("src/lib/server/cms.ts", { react: { cache: (fn: unknown) => fn }, "./db": { getPool }, "./activity-log": activity, "../cms": cmsModel, "./db-errors": dbErrors, "./upload-persistence": persistence });
const assets = new Set<string>(), discarded: string[] = [];
let lastUpload = { url: "", publicId: "" }, onUpload: (() => Promise<void>) | undefined, cleanupFails = false, authAllowed = true;
const storage = { ...cloudinary, imageStorageReady: () => true,
  uploadImage: async () => {
    const publicId = `synthetic/${randomUUID()}`, url = `https://res.cloudinary.com/test-cloud/image/upload/${publicId}.webp`;
    assets.add(publicId); lastUpload = { publicId, url }; await onUpload?.(); return lastUpload;
  }, discardUpload: async (id: string) => { discarded.push(id); if (cleanupFails) throw new Error("injected cleanup failure"); assets.delete(id); },
};
const auth = { requireRole: async () => authAllowed ? { ok: true, user: { id: admin } } : { ok: false, response: Response.json({ error: "Not authenticated" }, { status: 401 }) } };
const imageRoute = load("src/app/api/admin/images/[kind]/[id]/route.ts", {
  "@/lib/server/auth-guard": auth, "@/lib/server/admin/images": images, "@/lib/server/cloudinary": storage,
  "@/lib/image-upload": await import("../../src/lib/image-upload.ts"), "@/lib/server/upload-persistence": persistence,
  "@/lib/server/request-origin": await import("../../src/lib/server/request-origin.ts"),
  "@/lib/server/http-json": await import("../../src/lib/server/http-json.ts"),
});
const cmsRoute = load("src/app/api/admin/cms/pages/[id]/image/route.ts", {
  "@/lib/server/auth-guard": auth, "@/lib/server/request-origin": await import("../../src/lib/server/request-origin.ts"),
  "@/lib/server/cms": cms, "@/lib/cms": cmsModel, "@/lib/image-upload": await import("../../src/lib/image-upload.ts"),
  "@/lib/server/cloudinary": storage, "@/lib/server/upload-persistence": persistence,
});
function imageRequest(extra?: Record<string, string>) {
  const form = new FormData(); form.set("file", new File([new Uint8Array([137,80,78,71,13,10,26,10])], "synthetic.png", { type: "image/png" }));
  for (const [key, value] of Object.entries(extra ?? {})) form.set(key, value);
  return new Request("http://localhost/api/admin/images/vehicles/1", { method: "POST", headers: { origin: "http://localhost" }, body: form });
}
async function postImage(kind = "vehicles", id = vehicleIds[0]) { return imageRoute.POST(imageRequest(), { params: { kind, id: String(id) } }) as Promise<Response>; }
async function postCms(id: string) {
  const p = await cms.getCmsPage(id), document = cmsModel.cmsDefaultDocument("about");
  return cmsRoute.POST(imageRequest({ version: String(p.version), sectionId: document.sections[0].id, target: "background", title: "Synthetic CMS", document: JSON.stringify(document) }), { params: { id } }) as Promise<Response>;
}
type QueryEffect = (sql: string, args: unknown[], run: () => Promise<any>) => Promise<any>;
async function intercept<T>(effect: QueryEffect, work: () => Promise<T>): Promise<T> {
  const connect = app.connect;
  app.connect = ((callback?: Parameters<typeof connect>[0]) => {
    // Pool.query uses callback-style connect. Leave these ordinary reads/logs
    // alone; inject only into the model's explicitly acquired transaction.
    if (callback) return connect.call(app, callback);
    return (connect as () => Promise<pg.PoolClient>).call(app).then(client => new Proxy(client, { get(target, key) {
      if (key === "query") return (sql: string, ...args: unknown[]) => effect(sql, args, () => Reflect.apply(target.query, target, [sql, ...args]));
      const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } }));
  }) as typeof app.connect;
  try { return await work(); } finally { app.connect = connect; }
}
function fault(mode: "write" | "commit-lost" | "commit-not-sent" | "rollback-lost", afterCommit?: () => Promise<void>): QueryEffect {
  let fired = false;
  return async (sql, _args, run) => {
    if (!fired && ["write", "rollback-lost"].includes(mode) && /INSERT INTO vehicle_images|UPDATE regions SET image_url|UPDATE cms_pages SET title/.test(sql)) {
      fired = true; throw new cloudinary.ImageError("injected save rejection", 409);
    }
    if (!fired && sql === "COMMIT" && ["commit-lost", "commit-not-sent"].includes(mode)) {
      fired = true; if (mode === "commit-lost") { await run(); await afterCommit?.(); }
      throw new Error("injected lost COMMIT acknowledgement");
    }
    const result = await run();
    if (sql === "ROLLBACK" && mode === "rollback-lost") throw new Error("injected lost rollback acknowledgement");
    return result;
  };
}
async function waiting(count = 1) {
  for (let i = 0; i < 100; i++) {
    const r = await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [tag]);
    if (r.rows[0].n >= count) return; await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail(`Expected ${count} application transactions waiting on PostgreSQL locks`);
}
async function ordered(sql: string, params: unknown[], calls: (() => Promise<unknown>)[]) {
  const guard = await pool.connect(), tasks: Promise<unknown>[] = [], states: { state: string; code?: string }[] = [];
  try {
    await guard.query("BEGIN"); await guard.query(sql, params);
    for (const call of calls) {
      const state = { state: "pending" } as { state: string; code?: string }; states.push(state);
      const task = call(); tasks.push(task);
      void task.then(() => { state.state = "fulfilled"; }, error => { state.state = "rejected"; state.code = String(error?.code ?? error?.name ?? "unknown"); });
      await waiting(tasks.length);
    }
    await guard.query("COMMIT"); return (await Promise.all(tasks)) as any[];
  } catch (error) {
    const activity = (await pool.query("SELECT state,wait_event_type,wait_event,left(query,55) AS statement FROM pg_stat_activity WHERE application_name=$1", [tag])).rows;
    console.error("Controlled contention diagnostics", JSON.stringify({ states, activity }));
    throw error;
  } finally { await guard.query("ROLLBACK"); guard.release(); await Promise.allSettled(tasks); }
}
async function booking(status = "Completed", vehicle = vehicleIds[0], total = 1000, start = "2090-01-01T10:00:00Z") {
  const id = randomUUID(); bookingIds.push(id);
  await pool.query(`INSERT INTO bookings(booking_id,booking_reference,user_id,booking_type_id,vehicle_type_id,vehicle_id,start_datetime,status,total_amount)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id,randomUUID().slice(0,20),customer,bookingType,typeId,vehicle,start,status,total]); return id;
}
async function newPage() {
  const p = await cms.createCmsPage({ slug: `race-${randomUUID()}`, title: "Synthetic CMS" }, admin); pageIds.push(p.id); return p.id as string;
}
async function statement(vendor = vendorIds[0]) { return (await pool.query("SELECT * FROM payouts WHERE vendor_profile_id=$1 AND period_start=$2", [vendor,month+"-01"])).rows[0]; }
async function generate(m = month) { const result = await vendors.generatePayouts(m, admin); assert(result.ok); return result; }
try {
  for (const id of userIds) await pool.query("INSERT INTO users(user_id,name,email,phone,password_hash,role_id) VALUES($1,'Content race test',$2,'','disabled',(SELECT role_id FROM roles WHERE name=$3))", [id,`${id}@example.invalid`,id===admin?"admin":"customer"]);
  typeId = (await pool.query("INSERT INTO vehicle_types(slug,title) VALUES($1,'Content race type') RETURNING vehicle_type_id", [tag])).rows[0].vehicle_type_id;
  for (let i=0;i<2;i++) vehicleIds.push((await pool.query("INSERT INTO vehicles(vehicle_type_id,name,seating_capacity,base_price_per_day) VALUES($1,'Content race vehicle',6,1000) RETURNING vehicle_id", [typeId])).rows[0].vehicle_id);
  regionId = (await pool.query("INSERT INTO regions(name,state) VALUES($1,'Synthetic state') RETURNING region_id", [tag])).rows[0].region_id;
  bookingType = (await pool.query("SELECT booking_type_id FROM booking_types WHERE code='point_to_point'")).rows[0].booking_type_id;
  for (const kind of ["vehicles", "regions"]) {
    const id = kind === "vehicles" ? vehicleIds[0] : regionId;
    for (const mode of ["write", "commit-lost", "commit-not-sent", "rollback-lost"] as const) {
      const n = discarded.length, r = await intercept(fault(mode), () => postImage(kind,id));
      assert.equal(r.status, mode === "write" || mode === "rollback-lost" ? 409 : 500);
      assert.equal(discarded.length-n, mode === "write" ? 1 : 0);
      assert.equal(assets.has(lastUpload.publicId), mode !== "write");
      const saved = await images.listImages(kind as "vehicles" | "regions",id);
      assert.equal(saved.some(image=>image.url===lastUpload.url), mode === "commit-lost");
    }
    assert.equal((await postImage(kind,id)).status,200);
    pass(`${kind} upload: acknowledged rollback cleans up; lost COMMIT/ROLLBACK acknowledgements retain asset; normal save works`);
  }
  {
    const id=await newPage();
    for (const mode of ["write", "commit-lost", "commit-not-sent", "rollback-lost"] as const) {
      const n=discarded.length,r=await intercept(fault(mode),()=>postCms(id));
      assert.equal(r.status,mode === "write" || mode === "rollback-lost" ? 409 : 500);
      assert.equal(discarded.length-n,mode === "write"?1:0);assert.equal(assets.has(lastUpload.publicId),mode!=="write");
      assert.equal(JSON.stringify((await cms.getCmsPage(id)).draft).includes(lastUpload.url),mode==="commit-lost");
    }
    pass("CMS upload uses the same pre-COMMIT rollback proof and retains uncertain assets");
  }
  {
    const id=await newPage(),n=discarded.length;
    const r=await intercept(fault("commit-lost",async()=>{
      const saved=await cms.getCmsPage(id);await cms.changeCmsPage(id,{action:"publish",version:saved.version},admin);
      const published=await cms.getCmsPage(id);await cms.changeCmsPage(id,{action:"save",version:published.version,title:published.title,draft:cmsModel.cmsDefaultDocument("about")},admin);
    }),()=>postCms(id));
    assert.equal(r.status,500);assert.equal(discarded.length,n);assert(assets.has(lastUpload.publicId));
    const row=(await pool.query("SELECT draft_content,published_content FROM cms_pages WHERE page_id=$1",[id])).rows[0];
    assert(!JSON.stringify(row.draft_content).includes(lastUpload.url));assert(JSON.stringify(row.published_content).includes(lastUpload.url));
    assert(JSON.stringify((await pool.query("SELECT content FROM cms_page_revisions WHERE page_id=$1",[id])).rows).includes(lastUpload.url));
    pass("lost CMS COMMIT then publish/draft replacement preserves the asset still referenced by publication/history");
  }
  {
    const n=discarded.length;onUpload=async()=>{await pool.query("UPDATE regions SET is_deleted=true WHERE region_id=$1",[regionId]);};
    assert.equal((await postImage("regions",regionId)).status,404);assert.equal(discarded.length,n+1);onUpload=undefined;
    await pool.query("UPDATE regions SET is_deleted=false WHERE region_id=$1",[regionId]);
    const id=await newPage();onUpload=async()=>{const p=await cms.getCmsPage(id);await cms.changeCmsPage(id,{action:"save",version:p.version,title:p.title,draft:p.draft},admin);};
    assert.equal((await postCms(id)).status,409);assert.equal(discarded.length,n+2);onUpload=undefined;
    cleanupFails=true;assert.equal((await intercept(fault("write"),()=>postImage())).status,409);cleanupFails=false;
    authAllowed=false;const before=assets.size;assert.equal((await postImage()).status,401);assert.equal(assets.size,before);authAllowed=true;
    pass("deleted target/version conflict safely clean new upload; cleanup failure preserves original status; anonymous upload never spends storage");
  }
  {
    const original=`https://res.cloudinary.com/test-cloud/image/upload/v1/jagdamba/development/${randomUUID()}.webp`;
    await images.saveImage("vehicles",vehicleIds[0],original,admin);
    const photo=(await images.listImages("vehicles",vehicleIds[0])).find(p=>p.url===original)!;assert(photo);
    const patch=(id:number,data:object,origin="http://localhost")=>imageRoute.PATCH(new Request(`http://localhost/api/admin/images/vehicles/${id}`,{method:"PATCH",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(data)}),{params:{kind:"vehicles",id:String(id)}}) as Promise<Response>;
    const body={action:"crop",imageId:photo.id,expectedUrl:original,crop:{x:100,y:200,width:800,height:500}};
    assert.equal((await patch(vehicleIds[0],body,"https://foreign.invalid")).status,403);
    authAllowed=false;assert.equal((await patch(vehicleIds[0],body)).status,401);authAllowed=true;
    assert.equal((await patch(vehicleIds[1],body)).status,404);
    assert.equal((await patch(vehicleIds[0],{...body,crop:{x:-1,y:0,width:800,height:500}})).status,400);
    assert.equal((await patch(vehicleIds[0],body)).status,200);
    const cropped=(await images.listImages("vehicles",vehicleIds[0])).find(p=>p.id===photo.id)!;
    assert(cropped.url.includes('/c_crop,x_100,y_200,w_800,h_500/'));assert.equal(cropped.primary,photo.primary);
    assert.equal((await patch(vehicleIds[0],body)).status,409);
    assert.equal((await patch(vehicleIds[0],{...body,expectedUrl:cropped.url,crop:null})).status,200);
    assert.equal((await images.listImages("vehicles",vehicleIds[0])).find(p=>p.id===photo.id)?.url,original);
    await images.changeImage("vehicles",vehicleIds[0],photo.id,"remove",admin);
    assert.equal((await patch(vehicleIds[0],body)).status,404);
    pass("real crop API checks admin/origin/ownership/bounds, preserves primary/original, rejects stale/deleted edits, and restores full photo");
  }
  {
    const id=await booking(),first=await reviews.upsertReview(id,customer,{rating:5,body:"Original"});assert(first.ok);
    assert(await reviews.setReviewPublished(first.review.id,false,admin));
    const edit=await reviews.upsertReview(id,customer,{rating:4,body:"Edited"});assert(edit.ok&&!edit.review.isPublished);
    assert(await reviews.deleteReview(first.review.id,admin));const retry=await reviews.upsertReview(id,customer,{rating:5,body:"Resurrect"});assert(!retry.ok&&retry.status===409);
    assert.equal(await reviews.getReviewForBooking(id),null);assert(!(await reviews.listPublishedReviews(1000)).some(r=>r.id===first.review.id));
    assert(!await reviews.setReviewPublished(first.review.id,true,admin));
    pass("review edits preserve unpublished state; deleted reviews cannot be resurrected or republished");
  }
  for(const deleteFirst of [true,false]){
    const id=await booking(),r=await reviews.upsertReview(id,customer,{rating:5});assert(r.ok);
    const edit=()=>reviews.upsertReview(id,customer,{rating:3,body:"Concurrent edit"}),remove=()=>reviews.deleteReview(r.review.id,admin);
    const results=await ordered("SELECT 1 FROM reviews WHERE review_id=$1 FOR UPDATE",[r.review.id],deleteFirst?[remove,edit]:[edit,remove]);
    if(deleteFirst)assert(!results[1].ok&&results[1].status===409);else assert(results[0].ok&&results[0].review.id===r.review.id);
    assert.equal(await reviews.getReviewForBooking(id),null);pass(`review deletion / edit serialized in ${deleteFirst?"delete-first":"edit-first"} order with valid responses`);
  }
  {
    const id=await booking();const r=await Promise.all([reviews.upsertReview(id,customer,{rating:4}),reviews.upsertReview(id,customer,{rating:5})]);
    assert(r.every(x=>x.ok));assert.equal((await pool.query("SELECT count(*)::int AS n FROM reviews WHERE booking_id=$1",[id])).rows[0].n,1);
    for(const [bid,uid,rating,status] of [[id,stranger,5,404],[randomUUID(),customer,5,404],[await booking("PendingPayment"),customer,5,409],[id,customer,6,400]] as const){const x=await reviews.upsertReview(bid,uid,{rating});assert(!x.ok&&x.status===status);}
    const original=await reviews.getReviewForBooking(id);
    await assert.rejects(intercept(async(sql,_args,run)=>{if(sql.includes("WHERE rv.booking_id=$1"))throw new Error("injected hydration failure");return run();},()=>reviews.upsertReview(id,customer,{rating:1})),/hydration failure/);
    assert.deepEqual(await reviews.getReviewForBooking(id),original);
    const guarded=await booking();const result=await ordered("UPDATE bookings SET status='Cancelled' WHERE booking_id=$1",[guarded],[()=>reviews.upsertReview(guarded,customer,{rating:5})]);assert(!result[0].ok&&result[0].status===409);
    pass("single review under concurrent creation, ownership/completion/validation guards, atomic rollback and eligibility after lock wait");
  }
  // Reserve two empty far-future test periods. Any zero statements for other
  // approved vendors are synthetic rows tagged by this fixture admin and removed.
  const year=8000+Math.floor(Math.random()*1000);month=`${year}-04`;otherMonth=`${year}-05`;
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM payouts WHERE period_start IN ($1,$2)",[month+"-01",otherMonth+"-01"])).rows[0].n,0);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM bookings WHERE start_datetime >= $1 AND start_datetime < $2",[month+"-01",`${year}-06-01`])).rows[0].n,0);
  for(let i=0;i<3;i++)vendorIds.push((await pool.query("INSERT INTO vendor_profiles(business_name,status) VALUES($1,$2) RETURNING vendor_profile_id",[`${tag}-${i}`,i<2?"approved":"pending"])).rows[0].vendor_profile_id);
  await pool.query("UPDATE vehicles SET vendor_profile_id=$2 WHERE vehicle_id=$1",[vehicleIds[1],vendorIds[0]]);
  const payable=await booking("Completed",vehicleIds[1],1000,month+"-05T09:00:00Z");await booking("PendingPayment",vehicleIds[1],9999,month+"-07T09:00:00Z");
  {
    // Warm the old UI cache with a deliberately different value without editing
    // the actual setting. Generation must read the DB, not reuse this cache.
    const setting=(await pool.query("SELECT setting_value FROM site_settings WHERE setting_key='vendor_commission_pct'")).rows[0];
    const raw=Number(setting?.setting_value),pct=Number.isFinite(raw)&&raw>=0&&raw<=100?raw:0;
    globalDb.__pgPool={query:async()=>({rows:[{setting_key:"vendor_commission_pct",setting_value:String(pct===20?30:20)}]})} as unknown as pg.Pool;
    invalidateSiteSettings();await getSiteSettings();globalDb.__pgPool=app;
    await generate();const row=await statement();assert.equal(Number(row.gross_amount),1000);assert.equal(row.booking_count,1);assert.equal(Number(row.commission_pct),pct);
    assert.equal(Number((await statement(vendorIds[1])).gross_amount),0);assert.equal(await statement(vendorIds[2]),undefined);
    pass("payout totals include only Completed trips, use fresh commission and include approved zero-booking vendors only");
  }
  {
    let resume=()=>{},paused=()=>{};const gate=new Promise<void>(r=>{resume=r;}),entered=new Promise<void>(r=>{paused=r;});let held=false;
    await intercept(async(sql,_args,run)=>{const result=await run();if(!held&&sql.includes("count(b.booking_id)::int")){held=true;paused();await gate;}return result;},async()=>{
      const old=generate();void old.catch(()=>{});let newer:ReturnType<typeof generate>|undefined;
      try{await entered;await pool.query("UPDATE bookings SET total_amount=2000 WHERE booking_id=$1",[payable]);newer=generate();void newer.catch(()=>{});await waiting();
        await generate(otherMonth);resume();await old;await newer;assert.equal(Number((await statement()).gross_amount),2000);
      }finally{resume();await Promise.allSettled([old,...(newer?[newer]:[])]);}
    });
    pass("overlapping month generations cannot overwrite fresh totals with an old tally; different months proceed independently");
  }
  for(const loss of ["status","booking-deleted","vehicle-deleted","vehicle-detached"]){
    await pool.query("UPDATE bookings SET status='Completed',is_deleted=false WHERE booking_id=$1",[payable]);
    await pool.query("UPDATE vehicles SET is_deleted=false,vendor_profile_id=$2 WHERE vehicle_id=$1",[vehicleIds[1],vendorIds[0]]);await generate();assert.equal(Number((await statement()).gross_amount),2000);
    if(loss==="status")await pool.query("UPDATE bookings SET status='Cancelled' WHERE booking_id=$1",[payable]);
    if(loss==="booking-deleted")await pool.query("UPDATE bookings SET is_deleted=true WHERE booking_id=$1",[payable]);
    if(loss==="vehicle-deleted")await pool.query("UPDATE vehicles SET is_deleted=true WHERE vehicle_id=$1",[vehicleIds[1]]);
    if(loss==="vehicle-detached")await pool.query("UPDATE vehicles SET vendor_profile_id=NULL WHERE vehicle_id=$1",[vehicleIds[1]]);
    await generate();const row=await statement();assert.equal(row.booking_count,0);assert.equal(Number(row.gross_amount),0);assert.equal(Number(row.net_amount),0);
    pass(`payout refresh clears the stale pending balance after last qualifying ${loss} change`);
  }
  await pool.query("UPDATE bookings SET status='Completed',is_deleted=false,total_amount=2000 WHERE booking_id=$1",[payable]);
  await pool.query("UPDATE vehicles SET is_deleted=false,vendor_profile_id=$2 WHERE vehicle_id=$1",[vehicleIds[1],vendorIds[0]]);await generate();
  for(const settleFirst of [true,false]){
    const p=await statement();await pool.query("UPDATE payouts SET status='pending',method=NULL,reference=NULL,gross_amount=1000 WHERE payout_id=$1",[p.payout_id]);
    const settle=()=>vendors.settlePayout(p.payout_id,{status:settleFirst?"paid":"void",method:"synthetic",reference:"synthetic"},admin);
    await ordered("SELECT 1 FROM payouts WHERE payout_id=$1 FOR UPDATE",[p.payout_id],settleFirst?[settle,()=>generate()]:[()=>generate(),settle]);
    const after=await statement();assert.equal(after.status,settleFirst?"paid":"void");assert.equal(Number(after.gross_amount),settleFirst?1000:2000);
    await generate();assert.deepEqual(await statement(),after);pass(`generation / settlement ${settleFirst?"settle-first":"generation-first"} preserves terminal amount and payment details`);
  }
  {
    const p=await statement();await pool.query("UPDATE payouts SET status='pending',is_deleted=true WHERE payout_id=$1",[p.payout_id]);const before=await statement();await generate();assert.deepEqual(await statement(),before);
    await pool.query("UPDATE payouts SET is_deleted=false WHERE payout_id=$1",[p.payout_id]);
    const snapshot=async()=> (await pool.query("SELECT * FROM payouts WHERE created_by=$1 ORDER BY payout_id",[admin])).rows;
    const old=await snapshot();await pool.query("UPDATE bookings SET total_amount=3000 WHERE booking_id=$1",[payable]);
    await assert.rejects(intercept(async(sql,_args,run)=>{if(sql.includes("WHERE p.is_deleted = false AND p.period_start"))throw new Error("injected generation failure");return run();},()=>generate()),/generation failure/);
    assert.deepEqual(await snapshot(),old);await generate();assert.equal(Number((await statement()).gross_amount),3000);
    assert(!(await vendors.generatePayouts("invalid",admin)).ok);
    pass("deleted statements remain immutable; failed generation rolls back the entire batch and releases its month lock");
  }
  console.log(`PASS ${checks} upload/review/payout regression groups`);
} finally {
  globalDb.__pgPool=app;onUpload=undefined;
  try {
    await pool.query("DELETE FROM activity_logs WHERE user_id=ANY($1::uuid[])",[userIds]);
    await pool.query("DELETE FROM payouts WHERE created_by=$1",[admin]);
    await pool.query("DELETE FROM bookings WHERE booking_id=ANY($1::uuid[])",[bookingIds]);
    await pool.query("DELETE FROM cms_pages WHERE page_id=ANY($1::uuid[])",[pageIds]);
    await pool.query("DELETE FROM vehicles WHERE vehicle_id=ANY($1::int[])",[vehicleIds]);
    if(typeId)await pool.query("DELETE FROM vehicle_types WHERE vehicle_type_id=$1",[typeId]);
    if(regionId)await pool.query("DELETE FROM regions WHERE region_id=$1",[regionId]);
    await pool.query("DELETE FROM vendor_profiles WHERE vendor_profile_id=ANY($1::int[])",[vendorIds]);
    await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[])",[userIds]);
    const remaining=(await pool.query(`SELECT (SELECT count(*) FROM users WHERE user_id=ANY($1::uuid[]))+
      (SELECT count(*) FROM bookings WHERE booking_id=ANY($2::uuid[]))+(SELECT count(*) FROM cms_pages WHERE page_id=ANY($3::uuid[]))+
      (SELECT count(*) FROM payouts WHERE created_by=$4)+(SELECT count(*) FROM vehicles WHERE vehicle_id=ANY($5::int[])) AS n`,[userIds,bookingIds,pageIds,admin,vehicleIds])).rows[0].n;
    assert.equal(Number(remaining),0);assets.clear();console.log("Synthetic development fixtures removed and absence verified; only mocked Cloudinary assets used. No production access or external messages.");
  }finally{invalidateSiteSettings();await app.end();await pool.end();}
}
