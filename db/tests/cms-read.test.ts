import test from "node:test";
import assert from "node:assert/strict";
import { retryCmsRead } from "../../src/lib/server/cms-read.ts";
import { registerHooks } from "node:module";
import { cmsDefaultDocument } from "../../src/lib/cms.ts";
import type { Pool } from "pg";

// React18's standalone Node entry omits RSC cache. Memoization isn't under
// test here; run the real CMS getters with the same identity shim as content races.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "react") return { url: "data:text/javascript,export const cache = fn => fn;", shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { getPublishedCmsPage, getCmsNavigation, listCmsPages, changeCmsPage } = await import("../../src/lib/server/cms.ts");

test("public CMS reads recover once from a dropped socket or connection-acquisition timeout", async () => {
  for (const failure of [Object.assign(new Error("socket closed"), { code: "ECONNRESET" }), new Error("Connection terminated due to connection timeout"), new Error("timeout exceeded when trying to connect")]) {
    let calls = 0;
    const value = await retryCmsRead(async () => { if (++calls === 1) throw failure; return "published"; });
    assert.equal(value, "published"); assert.equal(calls, 2);
  }
});

test("a persistent outage stops after one retry and preserves the final error", async () => {
  let calls = 0; const failure = Object.assign(new Error("offline"), { code: "ETIMEDOUT" });
  await assert.rejects(retryCmsRead(async () => { calls++; throw failure; }), error => error === failure);
  assert.equal(calls, 2);
});

test("SQL cancellation, lock, credential, permission and schema errors are never retried", async () => {
  for (const code of ["57014", "55P03", "28P01", "42501", "42P01"]) {
    let calls = 0; const failure = Object.assign(new Error("timeout exceeded when trying to connect"), { code });
    await assert.rejects(retryCmsRead(async () => { calls++; throw failure; }), error => error === failure);
    assert.equal(calls, 1);
  }
});

test("actual published page/navigation getters recover without exposing drafts; admin operations do not replay", async () => {
  const globals = globalThis as typeof globalThis & { __pgPool?: Pool };
  const previous = globals.__pgPool; let calls = 0, connects = 0;
  const unavailable = Object.assign(new Error("connection lost"), { code: "ECONNRESET" });
  const document = cmsDefaultDocument("about");
  const fixture = {
    async query(sql: string) {
      calls++;
      if (calls % 2) throw unavailable;
      if (sql.includes("WHERE slug=$1")) return { rows: [{ published_content: document, status: "published", is_active: true, is_deleted: false }] };
      return { rows: ["home", "about"].map(slug => ({ slug, navigation: document.navigation, status: "draft", is_active: true, is_deleted: false })) };
    },
    async connect() { connects++; throw unavailable; },
  };
  globals.__pgPool = fixture as unknown as Pool;
  try {
    assert.deepEqual(await getPublishedCmsPage("about"), document); assert.equal(calls, 2);
    assert.deepEqual(await getCmsNavigation(), []); assert.equal(calls, 4);
    await assert.rejects(listCmsPages(), error => error === unavailable); assert.equal(calls, 5);
    await assert.rejects(changeCmsPage("ad46f5e2-93b7-4bea-b99c-5a9c2124b38b", { action: "publish", version: 1 }, "unused"), error => error === unavailable);
    assert.equal(connects, 1, "a CMS write must never be replayed");
  } finally { globals.__pgPool = previous; }
});
