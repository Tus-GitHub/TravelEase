import test from "node:test";
import assert from "node:assert/strict";
import { CMS_TYPES, cmsDefaultDocument, newCmsSection, validateCmsDocument, validateCmsSlug, cmsSafeImage, cmsSafeLink, cmsDocumentWithImage } from "../../src/lib/cms.ts";
import { cmsNavigationLinks } from "../../src/lib/cms-navigation.ts";

test("current homepage and About defaults survive JSON serialization", () => {
  for (const slug of ["home", "about", "our-services"]) {
    const input = cmsDefaultDocument(slug, "Our services");
    assert.deepEqual(validateCmsDocument(JSON.parse(JSON.stringify(input))), input);
  }
  assert.equal(cmsDefaultDocument("home").sections.length, 10);
});
test("every available section has valid defaults", () => {
  for (const type of CMS_TYPES) {
    const doc = cmsDefaultDocument("services"); doc.sections = [newCmsSection(type)];
    assert.deepEqual(validateCmsDocument(doc), doc);
  }
});
test("unknown fields/types, duplicate IDs and duplicate interactive sections are rejected", () => {
  const doc = cmsDefaultDocument("home");
  for (const mutate of [
    (d: any) => { d.sections[0].content.script = "alert(1)"; },
    (d: any) => { d.sections[0].type = "script"; },
    (d: any) => { d.sections[1].id = d.sections[0].id; },
    (d: any) => { d.sections.push(newCmsSection("hero")); },
    (d: any) => { d.schemaVersion = 2; },
    (d: any) => { d.sections = []; },
    (d: any) => { d.sections.forEach((s: any) => { s.visible = false; }); },
    (d: any) => { d.navigation.header = "true"; },
  ]) { const copy = structuredClone(doc); mutate(copy); assert.throws(() => validateCmsDocument(copy)); }
});
test("backgrounds, lengths and nested item types are bounded", () => {
  for (const mutate of [
    (d: any) => { d.sections[0].appearance.overlay = -1; },
    (d: any) => { d.sections[0].appearance.background = "image"; },
    (d: any) => { d.sections[0].content.title = "x".repeat(201); },
    (d: any) => { d.sections[0].content.items = [{ value: {}, label: "bad" }]; },
    (d: any) => { d.sections[0].content.body = "x".repeat(300000); },
    (d: any) => { d.navigation.order = 1.5; },
  ]) { const doc = cmsDefaultDocument("services"); mutate(doc); assert.throws(() => validateCmsDocument(doc)); }
});
test("application paths cannot be claimed by custom pages", () => {
  for (const slug of ["admin", "api", "vehicles", "booking", "profile", "cms-preview", "login", "../about", "test/page", "Home", "__proto__"]) assert.throws(() => validateCmsSlug(slug));
  assert.equal(validateCmsSlug("our-services"), "our-services");
});
test("unsafe links and untrusted image origins are refused", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,bad", "//evil.example", "/\\evil.example", "https://user:pass@example.com", "https://example.com\n"]) assert.equal(cmsSafeLink(url), false);
  for (const url of ["http://127.0.0.1/a.png", "https://res.cloudinary.com.evil.example/a", "data:image/png;base64,a", "https://example.com/a.png", "https://res.cloudinary.com/cloud/raw/upload/a"]) assert.equal(cmsSafeImage(url), false);
  assert(cmsSafeLink("/vehicles?category=family-cars")); assert(cmsSafeLink("https://example.com/info"));
  assert(cmsSafeImage("https://res.cloudinary.com/example/image/upload/photo.webp"));
});
test("reordering and hiding a section survive validation without changing content", () => {
  const doc = cmsDefaultDocument("home"), first = structuredClone(doc.sections[0]);
  doc.sections.reverse(); doc.sections[0].visible = false;
  const saved = validateCmsDocument(doc);
  assert.equal(saved.sections[0].visible, false); assert.deepEqual(saved.sections.at(-1), first);
});

test("uploads can update only declared image fields, without changing the caller's document", () => {
  const doc = cmsDefaultDocument("home"), section = doc.sections[0];
  const image = "https://res.cloudinary.com/example/image/upload/photo.webp";
  const updated = cmsDocumentWithImage(doc, section.id, "imageUrl", image);
  assert.equal(updated.sections[0].content.imageUrl, image);
  assert.equal(section.content.imageUrl, "");
  section.appearance.background = "image";
  assert.equal(cmsDocumentWithImage(doc, section.id, "background", image).sections[0].appearance.imageUrl, image);
  section.appearance.background = "default";
  for (const target of ["__proto__", "title", "items.0.label", "items.999.imageUrl", "constructor.prototype.imageUrl"])
    assert.throws(() => cmsDocumentWithImage(doc, section.id, target, image));
  assert.throws(() => cmsDocumentWithImage(doc, "missing", "imageUrl", image));
  assert.throws(() => cmsDocumentWithImage(doc, section.id, "imageUrl", "http://localhost/private"));
  const cards = newCmsSection("cards"); doc.sections.push(cards);
  assert.equal((cmsDocumentWithImage(doc, cards.id, "items.0.imageUrl", image).sections.at(-1)!.content.items as any[])[0].imageUrl, image);
});

test("navigation uses only enabled published entries and respects menu order", () => {
  const base = [{ href: "/", label: "Home" }, { href: "/vehicles", label: "Vehicles" }, { href: "/about", label: "About" }];
  const cms = [{ href: "/", label: "Welcome", header: true, footer: false, order: 0 }, { href: "/services", label: "Services", header: false, footer: true, order: 20 }];
  assert.deepEqual(cmsNavigationLinks(base, cms, "header"), [{ href: "/", label: "Welcome" }, base[1]]);
  assert.deepEqual(cmsNavigationLinks(base, cms, "footer"), [base[1], { href: "/services", label: "Services" }]);
  assert.deepEqual(cmsNavigationLinks(base, undefined, "header"), base);
  assert.deepEqual(validateCmsDocument(cmsDefaultDocument("a".repeat(160))), cmsDefaultDocument("a".repeat(160)));
});
