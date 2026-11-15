import test from "node:test";
import assert from "node:assert/strict";
import { blankPackageContent, validatePackageContent, validateRouteTree, selectPackageRoute, availableRouteTree, packagePlanDays, type RouteNode, type RouteTree } from "../../src/lib/package-content";
const node = (spotId: number, next: number[] = [], extraPricePerPerson = 0): RouteNode => ({ spotId, next, nights: next.length ? 0 : 1, extraPricePerPerson, description: "Guest activities", meals: { breakfast: 1, lunch: 0, dinner: 1 }, canFinish: next.length === 0 });
const tree = (): RouteTree => ({ roots: [1], nodes: [node(1, [2, 3]), node(2, [4], 300), node(3, [5], 200), node(4, [], 500), node(5, [], 400)] });
const names = new Map([[1, "Dehradun"], [2, "Mussoorie"], [3, "Rishikesh"], [4, "Chakrata"], [5, "Haridwar"]]);

test("a fixed plan requires at least one day instead of reaching storage with zero duration", () => {
  assert.throws(() => packagePlanDays({ ...blankPackageContent(), itinerary: [] }, "private", 1000, 1), /at least one day/);
});
test("public package plans retain counted meals, guest hotel information and guide inclusion, stripping supplier fields", () => {
  const input = { ...blankPackageContent(), guideIncluded: true, privateNotes: "Never publish", itinerary: [{ day: 99, title: "Explore", description: "Walk together", meals: ["breakfast", "dinner"], hotel: { hotelName: "Hill stay", hotelAddress: "Guest address", roomType: "Twin", notes: "Hot water", supplierCost: 500, contactPhone: "private" } }], routeTree: tree() };
  const content = validatePackageContent(input)!; assert.equal(content.itinerary[0].day, 1); assert.equal(content.guideIncluded, true); assert.deepEqual(content.itinerary[0].meals, ["breakfast", "dinner"]);
  assert.equal(content.itinerary[0].hotel?.hotelName, "Hill stay"); assert(!JSON.stringify(content).includes("supplierCost")); assert(!JSON.stringify(content).includes("contactPhone")); assert(!JSON.stringify(content).includes("privateNotes")); assert.equal(content.routeTree?.nodes.length, 5);
});
test("selected routes follow admin connections and derive their price, nights, names and meals", () => {
  const selected = selectPackageRoute(validateRouteTree(tree()), [1, 2, 4], 1000, names);
  assert.equal(selected.pricePerPerson, 1800); assert.equal(selected.days, 2); assert.equal(selected.nights, 1); assert.deepEqual(selected.meals, { breakfast: 3, lunch: 0, dinner: 3 }); assert.deepEqual(selected.stops.map(s => s.name), ["Dehradun", "Mussoorie", "Chakrata"]);
  assert.equal(selectPackageRoute(tree(), [1, 3, 5], 1000, names).pricePerPerson, 1600);
  assert.throws(() => selectPackageRoute(tree(), [1, 2, 5], 1000, names)); assert.throws(() => selectPackageRoute(tree(), [4], 1000, names)); assert.throws(() => selectPackageRoute(tree(), [1, 2], 1000, names));
  assert.equal(selectPackageRoute(tree(), [1, 2], 1000, names, false).pricePerPerson, 1300);
});
test("missing/inactive destinations and forged or repeated path nodes cannot be booked", () => {
  assert.throws(() => selectPackageRoute(tree(), [1, 2, 4], 1000, new Map([[1, "Start"], [2, "Next"]])));
  for (const value of [[1, 2, 2, 4], [1, "2", 4], [], [1, 99]]) assert.throws(() => selectPackageRoute(tree(), value, 1000, names));
});
test("route validation rejects loops, disconnected branches, duplicate nodes, multiple parents and unreachable finishes", () => {
  const bad = [
    { roots: [1], nodes: [node(1, [2]), node(2, [1])] },
    { roots: [1], nodes: [node(1), node(2)] },
    { roots: [1], nodes: [node(1, [1])] },
    { roots: [1], nodes: [node(1), node(1)] },
    { roots: [1], nodes: [node(1, [2, 3]), node(2, [4]), node(3, [4]), node(4)] },
    { roots: [1], nodes: [{ ...node(1), canFinish: false }] },
    { roots: [1], nodes: [{ ...node(1, [2]), nights: 13 }, { ...node(2), nights: 1 }] },
  ];
  for (const value of bad) assert.throws(() => validateRouteTree(value));
});
test("public route choices prune unavailable branches without inventing new places to finish", () => {
  const pruned = availableRouteTree(tree(), new Set([1, 2, 4, 3]));
  assert.deepEqual(pruned.nodes.map(n => n.spotId), [1, 2, 4]); assert.deepEqual(pruned.nodes[0].next, [2]); assert.equal(pruned.nodes[0].canFinish, false);
  assert.deepEqual(availableRouteTree(tree(), new Set([1, 2, 3])).roots, []);
});
test("meal choices and counts, rate precision and plan version are bounded", () => {
  for (const meals of [["breakfast", "breakfast"], ["snack"], "dinner"]) assert.throws(() => validatePackageContent({ ...blankPackageContent(), itinerary: [{ day: 1, title: "Day", description: "", meals }] }));
  for (const update of [{ extraPricePerPerson: 0.001 }, { nights: -1 }, { meals: { breakfast: -1, lunch: 0, dinner: 0 } }]) assert.throws(() => validateRouteTree({ roots: [1], nodes: [{ ...node(1), ...update }] }));
  assert.throws(() => validatePackageContent({ ...blankPackageContent(), version: 2 })); assert.equal(validatePackageContent(null), null);
});
