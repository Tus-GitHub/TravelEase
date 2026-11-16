import test from "node:test";
import assert from "node:assert/strict";
import { adminNavigation, adminNavActive } from "../../src/lib/admin-navigation.ts";

test("admin workflow keeps daily work first, related setup/pricing together and administration last", () => {
  const groups = adminNavigation("admin", () => true);
  const paths = groups.flatMap(group => group.items.map(item => item.href));
  assert.equal(paths.length, 19); assert.equal(new Set(paths).size, 19);
  assert.deepEqual(groups[0].items.map(item => item.href), ["/admin", "/admin/bookings", "/admin/support"]);
  assert.deepEqual(groups.find(group => group.label === "Masters & Resources")!.items.map(item => item.href), ["/admin/geography", "/admin/vehicles", "/admin/drivers", "/admin/vendors"]);
  assert.equal(groups.find(group => group.label === "Masters & Resources")!.items[1].label, "Vehicle");
  assert.deepEqual(groups.find(group => group.label === "Pricing & Offers")!.items.map(item => item.href), ["/admin/pricing", "/admin/seasonal-pricing", "/admin/coupons"]);
  assert.deepEqual(groups.at(-1)!.items.map(item => item.href), ["/admin/analytics", "/admin/permissions", "/admin/activity"]);
  assert.deepEqual(groups.find(group => group.label === "Trips & Packages")!.items.map(item => item.href), ["/admin/packages", "/admin/weekend-trips"]);
});
test("limited staff see only their existing grants and no empty headings or admin-only tools", () => {
  const groups = adminNavigation("agent", (_role, section) => ["vehicles", "packages"].includes(section));
  assert.deepEqual(groups.flatMap(group => group.items.map(item => item.href)), ["/admin", "/admin/vehicles", "/admin/packages"]);
  assert(groups.every(group => group.items.length));
  assert.deepEqual(adminNavigation("customer", () => false).map(group => group.label), ["Daily operations"]);
});
test("active highlighting follows real route segments and the existing guide route", () => {
  assert(adminNavActive("/admin/packages/123", { href: "/admin/packages" }));
  assert(!adminNavActive("/admin/packages-other", { href: "/admin/packages" }));
  assert(!adminNavActive("/admin/packages", { href: "/admin" }));
  assert(adminNavActive("/admin/tour-guides", { href: "/admin/weekend-trips", activePaths: ["/admin/tour-guides"] }));
});
