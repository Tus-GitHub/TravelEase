import test from "node:test";
import assert from "node:assert/strict";
import { cmsDefaultDocument, validateCmsDocument, validateCmsChrome, cmsItems } from "../../src/lib/cms.ts";
import { defaultCmsChrome, chromeNavigationLinks, chromeFooterGroups } from "../../src/lib/cms-chrome.ts";

test("header/footer round-trip inside the existing Home document without changing legacy pages", () => {
  const old = cmsDefaultDocument("home"), original = JSON.stringify(old);
  assert.deepEqual(validateCmsDocument(JSON.parse(original)), old);
  const chrome = defaultCmsChrome(); chrome.header.brandName = "Owner brand"; chrome.header.appearance = "dark"; chrome.footer.appearance = "light";
  const next = validateCmsDocument({ ...old, chrome }); assert.deepEqual(next.chrome, chrome);
  assert.equal(JSON.stringify(old), original);
  const separate = defaultCmsChrome(); chrome.header.links[0].label = "Changed"; assert.notEqual(separate.header.links[0].label, "Changed");
});
test("header/footer settings reject unsafe URLs, unsupported icons, invalid designs and oversized data", () => {
  for (const href of ["javascript:alert(1)", "//evil.example/path", "data:text/html,unsafe", "/bad path"]) {
    const value = defaultCmsChrome(); value.header.links[0].href = href; assert.throws(() => validateCmsChrome(value));
  }
  for (const mutate of [
    (value: ReturnType<typeof defaultCmsChrome>) => { value.header.brandIcon = "script" as never; },
    (value: ReturnType<typeof defaultCmsChrome>) => { value.footer.appearance = "random" as never; },
    (value: ReturnType<typeof defaultCmsChrome>) => { value.header.buttonLabel = "Book"; },
    (value: ReturnType<typeof defaultCmsChrome>) => { value.header.links = Array(13).fill({ label: "Link", href: "/contact" }); },
    (value: ReturnType<typeof defaultCmsChrome>) => { value.footer.description = "x".repeat(1001); },
  ]) { const value = defaultCmsChrome(); mutate(value); assert.throws(() => validateCmsChrome(value)); }
});
test("manual links keep order while opted-in published pages append without duplicate URLs", () => {
  const pages = [{ href: "/new", label: "New page", header: true, footer: true, order: 60 }, { href: "/manual", label: "Automatic duplicate", header: true, footer: true, order: 20 }, { href: "/off", label: "Off", header: false, footer: false, order: 10 }];
  assert.deepEqual(chromeNavigationLinks([{ label: "Owner label", href: "/manual" }], pages, "header"), [{ label: "Owner label", href: "/manual" }, { href: "/new", label: "New page" }]);
  const groups = chromeFooterGroups([{ title: "First", links: [] }, { title: "Second", links: [{ label: "Manual", href: "/manual" }] }], pages);
  assert.equal(groups.flatMap(group => group.links).filter(link => link.href === "/manual").length, 1);
  assert.equal(chromeFooterGroups([], pages)[0].links.length, 2);
});
test("new pages remain URL-only by default and feature style/icon choices validate independently", () => {
  const page = cmsDefaultDocument("new-page", "New page"); assert.equal(page.navigation.header, false); assert.equal(page.navigation.footer, false);
  const about = cmsDefaultDocument("about"), features = about.sections.find(section => section.type === "features")!;
  const items = cmsItems(features)!; items[0].style = "outlined"; items[0].icon = "shield-check";
  const checked = validateCmsDocument(about); assert.equal(cmsItems(checked.sections.find(section => section.type === "features"))![0].style, "outlined");
  items[0].style = "unsafe-css"; assert.throws(() => validateCmsDocument(about));
});
