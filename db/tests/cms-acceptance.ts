/** Real CMS browser -> API -> development PostgreSQL acceptance. No production, DDL or external mail. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, fork } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, realpath, lstat, unlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";
import { localMailSink } from "./_local-smtp.mjs";
import { discardUpload, imageStorageReady } from "../../src/lib/server/cloudinary.ts";
import { cmsDefaultDocument } from "../../src/lib/cms.ts";

assert(process.argv.includes("--dev") && !process.env.VERCEL && process.env.VERCEL_ENV !== "production", "Local development only");
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
const host = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
const owner = process.env.DATABASE_URL!, runtime = process.env.DATABASE_URL_APP!;
assert(owner && runtime && process.env.DATABASE_URL_PRODUCTION);
assert.equal(host(owner), host(runtime)); assert.notEqual(host(owner), host(process.env.DATABASE_URL_PRODUCTION));
const modulePath = process.argv.find(value => value.startsWith("--browser-module="))?.slice(17);
assert(modulePath, "Pass --browser-module=<installed Playwright module>");
const { chromium } = createRequire(import.meta.url)(modulePath);
const artifacts = process.argv.find(value => value.startsWith("--artifacts="))?.slice(12);
assert(imageStorageReady(), "Configure the existing development Cloudinary account before the live upload check");
const pool = new pg.Pool({ ...runtimeDatabaseConfig(owner), max: 4, application_name: "cms-acceptance-fixtures" });
const fixture = (role: string) => ({ id: randomUUID(), token: randomUUID(), role });
const admin = fixture("admin"), customer = fixture("customer");
const actors = [admin, customer], ids = actors.map(actor => actor.id);
const base = "http://127.0.0.1:3103", slug = `cms-check-${randomUUID()}`, title = "CMS acceptance page";
const draftText = `Private draft ${randomUUID()}`, nextText = `Revised draft ${randomUUID()}`;
const uploads: string[] = [], createdPages: string[] = [], errors: string[] = [];
let child: ReturnType<typeof fork> | undefined, browser: { close(): Promise<void> } | undefined;
let sink: Awaited<ReturnType<typeof localMailSink>> | undefined, sandbox: string | undefined;
let serverLog = "", checks = 0;
const redact = (s: string) => s.replace(/postgres(?:ql)?:\/\/\S+/g, "[database URL]").replace(/token=[^\s&"<>]+/g, "token=[redacted]");
async function api(route: string, actor: typeof admin | null = admin, method = "GET", data?: unknown, origin = base) {
  return fetch(base + route, { method, redirect: "manual", signal: AbortSignal.timeout(90_000),
    headers: { "Content-Type": "application/json", Origin: origin, ...(actor ? { Cookie: `session_token=${actor.token}` } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
}
async function status(response: Promise<Response>, expected: number, label: string) {
  const r = await response; checks++; assert.equal(r.status, expected, label); return r;
}
const cmsApi = "/api/admin/cms/pages";
async function read(id: string) { return (await (await status(api(`${cmsApi}/${id}`), 200, "Read saved draft")).json()); }
async function change(id: string, data: object, expected = 200) { return (await status(api(`${cmsApi}/${id}`, admin, "PATCH", data), expected, "CMS mutation")).json(); }
async function html(url: string, actor: typeof admin | null = null) { return (await api(url, actor)).text(); }

try {
  for (const actor of actors) {
    const result = await pool.query(`WITH fixture AS (
      INSERT INTO users(user_id,name,email,phone,password_hash,role_id,email_verified_at)
      SELECT $1,'CMS acceptance',$2,'',$3,role_id,now() FROM roles WHERE name=$4 RETURNING user_id
    ) INSERT INTO sessions(token,user_id,expires_at) SELECT $5,user_id,now()+interval '45 minutes' FROM fixture`,
    [actor.id, `cms-${actor.id}@example.invalid`, randomUUID(), actor.role, actor.token]);
    assert.equal(result.rowCount, 1);
  }
  sink = await localMailSink(actors.map(actor => `cms-${actor.id}@example.invalid`));
  child = fork(path.resolve("db/tests/_booking-server.cjs"), [], { execArgv: [], silent: true, windowsHide: true,
    env: { ...process.env, DATABASE_URL: runtime, NODE_ENV: "development", BOOKING_SMOKE_SERVER: "dev-only", APP_ORIGIN: base,
      SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "test", SMTP_PASS: "test", EMAIL_FROM: "CMS acceptance <test@example.invalid>" } });
  for (const stream of [child.stdout, child.stderr]) stream?.on("data", chunk => { serverLog = (serverLog + chunk.toString()).slice(-6000); });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Isolated CMS server startup timed out")), 120_000);
    child!.on("message", (message: { ready?: boolean; sandbox?: string }) => { if (message.sandbox) sandbox = message.sandbox; if (message.ready) { clearTimeout(timer); resolve(); } });
    child!.once("exit", code => { clearTimeout(timer); reject(new Error(`CMS server exited ${code}`)); });
  });
  console.log("CMS server ready: development DB, isolated source/build, no external mail.");
  await status(api(cmsApi, null), 401, "Anonymous cannot list drafts");
  await status(api(cmsApi, customer), 403, "Customer cannot list drafts");
  for (const data of [null, [], { title: "a", slug: "admin" }, { title: "a", slug: "a".repeat(161) }, { title: "a".repeat(6000) }])
    await status(api(cmsApi, admin, "POST", data), 400, "Malformed/reserved create rejected");
  await status(api(cmsApi, admin, "POST", {}, "https://foreign.invalid"), 403, "Foreign-origin create rejected");
  const all = (await (await status(api(cmsApi), 200, "Admin list")).json()).items;
  for (const builtin of ["home", "about"]) {
    const row = all.find((item: { slug: string }) => item.slug === builtin); assert(row);
    await change(row.id, { action: "delete", version: row.version }, 400);
    if (builtin === "home") await change(row.id, { action: "unpublish", version: row.version }, 400);
  }
  await status(api(cmsApi + "/not-a-uuid"), 404, "Invalid page identifier");
  const instance = await chromium.launch({ channel: "chrome", headless: true }); browser = instance;
  const context = await instance.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.addCookies([{ name: "session_token", value: admin.token, url: base, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage(); page.on("pageerror", (error: Error) => errors.push(redact(error.message)));
  await page.goto(base + "/admin/pages", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByRole("button", { name: "+ Create page", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Page name", { exact: true }).fill(title);
  await dialog.getByLabel(/^Page address/).fill(slug);
  const creation = page.waitForResponse((r: any) => r.url() === base + cmsApi && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Create draft", exact: true }).click();
  const created = await creation; assert.equal(created.status(), 201); checks++;
  let current = (await created.json()).item; createdPages.push(current.id);
  const id = current.id, route = `${cmsApi}/${id}`;
  await page.waitForURL(base + "/admin/pages/" + id);
  await page.getByLabel("Heading", { exact: true }).fill(draftText);
  await page.getByLabel(/^Body/).fill("A real saved draft with plain text, photographs and reusable sections.");
  await page.getByRole("button", { name: "+ Add section", exact: true }).click();
  await dialog.getByRole("button").filter({ hasText: "Image & text" }).click();
  const uploadResult = page.waitForResponse((r: any) => r.url() === `${base}${route}/image`);
  // A tiny valid PNG; a synthetic test asset, never a customer photo.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
  await page.getByLabel("Upload Photo", { exact: true }).setInputFiles({ name: "cms-check.png", mimeType: "image/png", buffer: png });
  const uploaded = await uploadResult, uploadData = await uploaded.json();
  if (uploadData.publicId) uploads.push(uploadData.publicId);
  assert.equal(uploaded.status(), 200, uploadData.error); checks++;
  assert.match(uploadData.publicId, /^jagdamba\/development\//); current = uploadData.item;
  assert.equal(current.status, "draft");
  await page.getByRole("status").filter({ hasText: "Image uploaded" }).waitFor();
  const imageSection = current.draft.sections.find((section: any) => section.type === "image-text");
  assert.equal(imageSection.content.imageUrl, uploadData.url);
  await page.getByRole("button", { name: "Move Image & text up", exact: true }).click();
  await page.getByRole("button", { name: "Hide Image & text", exact: true }).click();
  await page.getByRole("button", { name: "Edit Text & statistics", exact: true }).click();
  await page.getByLabel("Background", { exact: true }).selectOption("image");
  await page.getByLabel("Background image", { exact: true }).fill(uploadData.url);
  await page.getByRole("tab", { name: "Page settings", exact: true }).click();
  await page.getByLabel("SEO title", { exact: true }).fill("CMS search title");
  await page.getByLabel("SEO description", { exact: true }).fill("Saved CMS search description.");
  await page.getByLabel("Show in main menu", { exact: true }).check();
  await page.getByLabel("Show in footer", { exact: true }).check();
  await page.getByLabel("Menu label", { exact: true }).fill("CMS test menu");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await dialog.getByRole("heading", { name: "Preview your page", exact: true }).waitFor();
  await page.frameLocator('iframe[title="Page draft preview"]').getByRole("heading", { name: draftText, exact: true }).waitFor({ timeout: 90_000 });
  await dialog.getByRole("button", { name: "Mobile", exact: true }).click();
  assert.equal(await page.locator('iframe[title="Page draft preview"]').evaluate((el: HTMLElement) => el.offsetWidth), 375);
  await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
  current = (await read(id)).item;
  assert.equal(current.draft.sections[0].id, imageSection.id); assert.equal(current.draft.sections[0].visible, false);
  for (const actor of [null, customer]) {
    assert(!(await html(`/cms-preview/${id}`, actor)).includes(draftText), "Preview must not leak to non-admins");
    await status(api(route, actor), actor ? 403 : 401, "Draft API access denied");
    await status(api(route, actor, "PATCH", { action: "publish", version: current.version }), actor ? 403 : 401, "Publishing access denied");
    await status(api(route + "/image", actor, "POST", {}), actor ? 403 : 401, "Upload access denied");
  }
  assert(!(await html(`/${slug}`)).includes(draftText)); assert(!(await html("/")).includes("CMS test menu"));
  console.log("PASS real create/edit, Cloudinary dev upload, reorder/hide, mobile draft preview; drafts stay private.");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal((await read(id)).item.status, "draft", "Cancel publication does not publish");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await dialog.getByRole("button", { name: "Publish page", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Page published." }).waitFor();
  let state = await read(id); current = state.item; const firstRevision = state.revisions[0];
  assert.equal(state.revisions.length, 1);
  const publicContext = await instance.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const publicPage = await publicContext.newPage(); publicPage.on("pageerror", (error: Error) => errors.push(redact(error.message)));
  await publicPage.goto(base + "/" + slug, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await publicPage.getByRole("heading", { name: draftText, exact: true }).waitFor();
  assert((await publicPage.title()).includes("CMS search title"));
  assert.equal(await publicPage.locator('meta[name="description"]').getAttribute("content"), "Saved CMS search description.");
  assert.equal(await publicPage.locator(`[data-cms-section="${imageSection.id}"]`).count(), 0);
  assert.equal(await publicPage.locator(`footer a[href="/${slug}"]`).count(), 1);
  const nextDraft = structuredClone(current.draft); nextDraft.sections.find((s: any) => s.type === "text").content.title = nextText;
  nextDraft.sections[0].visible = true;
  state = await change(id, { action: "save", title, version: current.version, draft: nextDraft }); current = state.item;
  let publishedHtml = await html(`/${slug}`); assert(publishedHtml.includes(draftText)); assert(!publishedHtml.includes(nextText));
  const simultaneous = await Promise.all([api(route, admin, "PATCH", { action: "save", title: "Concurrent A", version: current.version, draft: nextDraft }),
    api(route, admin, "PATCH", { action: "save", title: "Concurrent B", version: current.version, draft: nextDraft })]);
  assert.deepEqual(simultaneous.map(response => response.status).sort(), [200, 409]); checks += 2;
  current = (await read(id)).item;
  await change(id, { action: "publish", version: current.version - 1 }, 409);
  // Force a publication-history conflict to prove the public snapshot/version
  // roll back together. Only an owner-created fixture row is involved; no DDL.
  const injected = randomUUID();
  await pool.query("INSERT INTO cms_page_revisions(revision_id,page_id,version,content) VALUES($1,$2,$3,$4)", [injected, id, current.version + 1, JSON.stringify(current.draft)]);
  await change(id, { action: "publish", version: current.version }, 500);
  const rolledBack = (await read(id)).item;
  assert.equal(rolledBack.version, current.version);
  assert((await html(`/${slug}`)).includes(draftText), "Failed history insert must roll back publication");
  await pool.query("DELETE FROM cms_page_revisions WHERE revision_id=$1 AND page_id=$2", [injected, id]);
  state = await change(id, { action: "publish", version: current.version }); current = state.item;
  assert.equal(state.revisions.length, 2);
  publishedHtml = await html(`/${slug}`); assert(publishedHtml.includes(nextText)); assert(!publishedHtml.includes(draftText));
  const persisted = (await pool.query("SELECT draft_content,published_content,status FROM cms_pages WHERE page_id=$1", [id])).rows[0];
  assert.equal(persisted.status, "published"); assert.deepEqual(persisted.published_content, persisted.draft_content);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Revision history", exact: true }).click();
  await page.getByRole("button", { name: "Restore to draft", exact: true }).last().click();
  await dialog.getByRole("button", { name: "Restore to draft", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Revision restored to your draft." }).waitFor();
  state = await read(id); current = state.item;
  assert.equal(state.revisions.at(-1).id, firstRevision.id);
  assert.equal(current.draft.sections[0].visible, false);
  assert((await html(`/${slug}`)).includes(nextText), "Restore does not change the public snapshot");
  console.log("PASS publish/cancel, SEO/menu rendering, draft isolation, single concurrency winner and custom revision restore.");
  await page.getByRole("tab", { name: "Sections", exact: true }).click();
  await page.getByRole("button", { name: "Edit Image & text", exact: true }).click();
  if (artifacts) {
    await mkdir(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, "cms-editor-desktop.png"), fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    // Resize delivery and responsive CSS must settle before measuring layout.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(artifacts, "cms-editor-mobile.png"), fullPage: true });
    const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && el.getBoundingClientRect().width > 0)
        .slice(0, 8).map(el => ({ tag: el.tagName, cls: el.className, right: el.getBoundingClientRect().right })) }));
    if (layout.scroll > layout.width) errors.push("Mobile overflow: " + JSON.stringify(layout));
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  for (const data of [null, [], { action: "save", version: current.version, title, draft: { script: "unsafe" } }, { action: "save", version: current.version, title: "x".repeat(300000) }])
    await status(api(route, admin, "PATCH", data), 400, "Invalid save rejected");
  await status(api(route, admin, "PATCH", {}, "https://foreign.invalid"), 403, "Foreign-origin save rejected");
  await status(api(route + "/image", admin, "POST", {}, "https://foreign.invalid"), 403, "Foreign-origin upload rejected");
  await status(api(route + "/image", admin, "POST", {}), 400, "Malformed multipart rejected");
  await status(api(cmsApi, admin, "POST", { title, slug }), 409, "Duplicate slug rejected");
  const copy = (await (await status(api(cmsApi, admin, "POST", { title: "Home template test", slug: slug + "-home", template: "home", status: "published", created_by: customer.id }), 201, "Homepage template")).json()).item;
  createdPages.push(copy.id); assert.equal(copy.status, "draft"); assert.equal(copy.draft.sections.length, 10);
  assert.equal((await pool.query("SELECT created_by FROM cms_pages WHERE page_id=$1", [copy.id])).rows[0].created_by, admin.id);
  await change(copy.id, { action: "restore", version: copy.version, revisionId: firstRevision.id }, 404);
  // Exercise all native homepage blocks through the real preview renderer.
  const homePreview = await html(`/cms-preview/${copy.id}`, admin);
  for (const section of cmsDefaultDocument("home").sections) assert(homePreview.includes(`data-cms-section="${section.id}"`), `Home preview renders ${section.type}`);
  await change(id, { action: "unpublish", version: current.version }); current = (await read(id)).item;
  assert(!(await html(`/${slug}`)).includes(nextText)); assert(!(await html("/")).includes("CMS test menu"));
  await change(id, { action: "delete", version: current.version });
  await status(api(route), 404, "Removed page hidden from editor");
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM cms_page_revisions WHERE page_id=$1", [id])).rows[0].n), 2, "Soft removal retains history");
  const privileges = (await pool.query("SELECT has_table_privilege($1,'cms_page_revisions','UPDATE') AS edit,has_table_privilege($1,'cms_page_revisions','DELETE') AS remove", [decodeURIComponent(new URL(runtime).username)])).rows[0];
  assert.deepEqual(privileges, { edit: false, remove: false });
  assert.deepEqual(errors, []); assert.equal(sink.messages.length, 0); assert.deepEqual(sink.rejected, []);
  console.log(`PASS ${checks} HTTP checks plus browser/DB assertions; upload, permissions, validation, all homepage sections, unpublish and soft removal. Production untouched.`);
} catch (error) {
  console.error("Recent isolated log:", redact(serverLog)); throw error;
} finally {
  try { await browser?.close(); }
  finally {
    if (child && child.exitCode === null) await new Promise<void>(resolve => {
      const timer = setTimeout(() => { child?.kill(); resolve(); }, 20_000);
      child!.once("exit", () => { clearTimeout(timer); resolve(); });
      if (child!.connected) child!.send("stop"); else child!.kill();
    });
    await sink?.close();
    try {
      const pageIds = (await pool.query("SELECT page_id FROM cms_pages WHERE created_by=ANY($1::uuid[])", [ids])).rows.map(row => row.page_id);
      await pool.query("DELETE FROM cms_pages WHERE page_id=ANY($1::uuid[]) AND created_by=ANY($2::uuid[])", [pageIds, ids]);
      await pool.query("DELETE FROM activity_logs WHERE user_id=ANY($1::uuid[])", [ids]);
      await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[]) AND name='CMS acceptance'", [ids]);
      const remaining = (await pool.query(`SELECT (SELECT count(*) FROM cms_pages WHERE page_id=ANY($1::uuid[])) +
        (SELECT count(*) FROM cms_page_revisions WHERE page_id=ANY($1::uuid[])) + (SELECT count(*) FROM users WHERE user_id=ANY($2::uuid[])) +
        (SELECT count(*) FROM sessions WHERE user_id=ANY($2::uuid[])) + (SELECT count(*) FROM activity_logs WHERE user_id=ANY($2::uuid[])) AS n`, [pageIds, ids])).rows[0];
      assert.equal(Number(remaining.n), 0);
      for (const publicId of uploads) { assert(publicId.startsWith("jagdamba/development/")); await discardUpload(publicId); }
      console.log("Synthetic pages, revisions, users, sessions, audit rows and the new dev image cleaned up.");
    } finally {
      await pool.end();
      if (sandbox) {
        const resolved = await realpath(sandbox), tempRoot = await realpath(os.tmpdir());
        assert.equal(path.dirname(resolved), tempRoot); assert(path.basename(resolved).startsWith("travel-booking-acceptance-"));
        const dependencies = path.join(resolved, "node_modules"), link = await lstat(dependencies).catch(() => null);
        if (link) { assert(link.isSymbolicLink()); assert.equal(await realpath(dependencies), await realpath("node_modules")); await unlink(dependencies); }
        await rm(resolved, { recursive: true, force: true, maxRetries: 6, retryDelay: 500 });
        console.log("Isolated server/source/build removed; normal localhost untouched.");
      }
    }
  }
}
