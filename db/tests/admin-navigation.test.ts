import test from "node:test";
import assert from "node:assert/strict";
import { adminNavigation, adminNavActive } from "../../src/lib/admin-navigation.ts";

test("grouped admin navigation retains all19 destinations once, with fleet rates beside vehicles", () => {
  const groups = adminNavigation("admin", () => true);
  const paths = groups.flatMap(group => group.items.map(item => item.href));
  assert.equal(paths.length, 19); assert.equal(new Set(paths).size, 19);
  assert.equal(paths[0], "/admin");
  assert.deepEqual(groups.find(group => group.label === "Vehicles & Partners")!.items.map(item => item.href), ["/admin/vehicles", "/admin/pricing", "/admin/drivers", "/admin/vendors"]);
  assert.equal(groups.find(group => group.label === "Vehicles & Partners")!.items[0].label, "Vehicle");
  assert.deepEqual(groups.find(group => group.label === "Trips & Packages")!.items.map(item => item.href), ["/admin/packages", "/admin/weekend-trips"]);
});
test("limited staff see only their existing grants and no empty headings or admin-only tools", () => {
  const groups = adminNavigation("agent", (_role, section) => ["vehicles", "packages"].includes(section));
  assert.deepEqual(groups.flatMap(group => group.items.map(item => item.href)), ["/admin", "/admin/packages", "/admin/vehicles"]);
  assert(groups.every(group => group.items.length));
  assert.deepEqual(adminNavigation("customer", () => false).map(group => group.label), ["Overview"]);
});
test("active highlighting follows real route segments and the existing guide route", () => {
  assert(adminNavActive("/admin/packages/123", { href: "/admin/packages" }));
  assert(!adminNavActive("/admin/packages-other", { href: "/admin/packages" }));
  assert(!adminNavActive("/admin/packages", { href: "/admin" }));
  assert(adminNavActive("/admin/tour-guides", { href: "/admin/weekend-trips", activePaths: ["/admin/tour-guides"] }));
});
