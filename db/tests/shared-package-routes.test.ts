import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRouteTree, selectPackageRoute, routeRange, availableRouteTree, type RouteTree } from "../../src/lib/package-content.ts";
import { layoutRoutePreview, ROUTE_CARD } from "../../src/lib/route-preview.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/delhi-route.json", import.meta.url), "utf8"));
const makeTree = (): RouteTree => structuredClone(fixture.tree);
const names = new Map<number, string>(fixture.places.map((place: { id: number; name: string }) => [place.id, place.name]));
function finishedPaths(tree: RouteTree): number[][] {
  const nodes = new Map(tree.nodes.map(node => [node.spotId, node])), paths: number[][] = [];
  function walk(id: number, path: number[]) { const node = nodes.get(id)!; path = [...path, id]; if (node.canFinish) paths.push(path); node.next.forEach(next => walk(next, path)); }
  tree.roots.forEach(id => walk(id, [])); return paths;
}

test("a32-destination Delhi plan allows multiple inbound routes and charges a shared stop once", () => {
  const tree = validateRouteTree(makeTree()); assert.equal(tree.nodes.length, 32);
  assert.equal(tree.nodes.filter(node => node.next.includes(10)).length, 3);
  const viaChandigarh = selectPackageRoute(tree, [1, 2, 10], 2000, names);
  const viaShimla = selectPackageRoute(tree, [1, 3, 10], 2000, names);
  assert.deepEqual(viaChandigarh.stops.map(stop => stop.name), ["Delhi", "Chandigarh", "Manali"]);
  assert.equal(viaChandigarh.pricePerPerson, 2500); assert.equal(viaShimla.pricePerPerson, 2600);
  assert.equal(viaChandigarh.nights, 1); assert.equal(viaChandigarh.meals.breakfast, 1);
  assert.throws(() => selectPackageRoute(tree, [1, 2, 10, 3, 10], 2000, names));
  assert.throws(() => selectPackageRoute(tree, [1, 2, 25], 2000, names));
});
test("shared-route min/max duration and minimum price match every allowed finish", () => {
  const tree = validateRouteTree(makeTree()), paths = finishedPaths(tree);
  assert(paths.length > 20);
  const choices = paths.map(path => selectPackageRoute(tree, path, 2000, names));
  assert.deepEqual(routeRange(tree, 2000), { minDays: Math.min(...choices.map(route => route.days)), maxDays: Math.max(...choices.map(route => route.days)), minPrice: Math.min(...choices.map(route => route.pricePerPerson)) });
});
test("unavailable parents prune only their own branches, preserving other ways to a shared stop", () => {
  const tree = validateRouteTree(makeTree()), active = new Set(tree.nodes.map(node => node.spotId)); active.delete(2);
  const pruned = availableRouteTree(tree, active);
  assert(!pruned.nodes.some(node => node.spotId === 2)); assert(pruned.nodes.some(node => node.spotId === 10));
  assert.equal(selectPackageRoute(pruned, [1, 3, 10], 2000, names).pricePerPerson, 2600);
  assert.deepEqual(finishedPaths(pruned), finishedPaths(tree).filter(path => !path.includes(2)));
  active.delete(10); const noManali = availableRouteTree(tree, active);
  assert(!noManali.nodes.some(node => [10, 22, 23, 32].includes(node.spotId)));
  assert.equal(availableRouteTree(tree, new Set()).nodes.length, 0);
});
test("multiple independent starts may join the same onward destinations", () => {
  const tree = makeTree(); tree.roots.push(31); tree.nodes.find(node => node.spotId === 18)!.next = [];
  tree.nodes.find(node => node.spotId === 18)!.canFinish = true;
  Object.assign(tree.nodes.find(node => node.spotId === 31)!, { next: [6, 18], canFinish: false });
  const valid = validateRouteTree(tree);
  assert(selectPackageRoute(valid, [31, 6, 17, 30], 2000, names));
  assert(selectPackageRoute(valid, [1, 6, 17, 30], 2000, names));
  const active = new Set(valid.nodes.map(node => node.spotId)); active.delete(1);
  const pruned = availableRouteTree(valid, active); assert.deepEqual(pruned.roots, [31]); assert(pruned.nodes.some(node => node.spotId === 6));
});
test("shared destinations do not weaken loop, start, duplicate or longest-night guards", () => {
  const cycle = makeTree(); cycle.nodes.find(node => node.spotId === 10)!.next.push(2); assert.throws(() => validateRouteTree(cycle), /loop/);
  const rootAsChild = makeTree(); rootAsChild.nodes[9].next.push(1); assert.throws(() => validateRouteTree(rootAsChild), /Starting points/);
  const duplicate = makeTree(); duplicate.nodes[0].next.push(2); assert.throws(() => validateRouteTree(duplicate), /duplicate|up to/);
  for (const order of [[2, 3], [3, 2]]) {
    const base = makeTree().nodes[0];
    const tooLong = { roots: [1], nodes: [{ ...base, next: order }, { ...base, spotId: 2, next: [4], nights: 0 }, { ...base, spotId: 3, next: [4], nights: 10 }, { ...base, spotId: 4, next: [], nights: 4, canFinish: true }] };
    assert.throws(() => validateRouteTree(tooLong), /thirteen nights/);
  }
});
test("dense32-node route graphs are processed by nodes and edges, without enumerating paths", () => {
  const base = makeTree().nodes[0];
  const tree = validateRouteTree({ roots: [1], nodes: Array.from({ length: 32 }, (_, i) => ({ ...base, spotId: i + 1, next: Array.from({ length: Math.min(8, 31 - i) }, (_, j) => i + j + 2), nights: 0, extraPricePerPerson: 1, canFinish: [16, 32].includes(i + 1) })) });
  let reads = 0;
  for (const node of tree.nodes) { const children = node.next; Object.defineProperty(node, "next", { enumerable: true, get() { assert(++reads <= 512, "Shared branches must be memoised"); return children; } }); }
  assert.deepEqual(routeRange(tree, 2000), { minDays: 1, maxDays: 1, minPrice: 2003 });
  reads = 0; assert.equal(availableRouteTree(tree, new Set(tree.nodes.map(node => node.spotId))).nodes.length, 32);
});
test("large admin preview has one non-overlapping card per destination and every joining edge", () => {
  const tree = validateRouteTree(makeTree()), before = JSON.stringify(tree), layout = layoutRoutePreview(tree);
  assert.equal(layout.nodes.length, 32); assert.equal(new Set(layout.nodes.map(node => node.id)).size, 32);
  assert.equal(layout.edges.length, tree.nodes.reduce((sum, node) => sum + node.next.length, 0));
  assert.deepEqual(layout.nodes.find(node => node.id === 10)!.parents, [2, 3, 9]);
  for (const node of layout.nodes) { assert(node.x >= 0 && node.y >= 0); assert(node.x + ROUTE_CARD.width <= layout.width); assert(node.y + ROUTE_CARD.height <= layout.height); }
  for (const a of layout.nodes) for (const b of layout.nodes) if (a.id !== b.id) assert(a.x + ROUTE_CARD.width <= b.x || b.x + ROUTE_CARD.width <= a.x || a.y + ROUTE_CARD.height <= b.y || b.y + ROUTE_CARD.height <= a.y);
  for (const edge of layout.edges) if (edge.points) for (let i = 1; i < edge.points.length; i++) {
    const a = edge.points[i - 1], b = edge.points[i];
    for (const node of layout.nodes) {
      const crosses = a.y === b.y ? a.y > node.y && a.y < node.y + ROUTE_CARD.height && Math.max(a.x, b.x) > node.x && Math.min(a.x, b.x) < node.x + ROUTE_CARD.width : a.x > node.x && a.x < node.x + ROUTE_CARD.width && Math.max(a.y, b.y) > node.y && Math.min(a.y, b.y) < node.y + ROUTE_CARD.height;
      assert(!crosses, `Connection${edge.from}->${edge.to} crosses destination${node.id}`);
    }
  }
  assert.equal(JSON.stringify(tree), before);
});
test("invalid draft previews stay bounded while the editor reports loops", () => {
  const tree = makeTree(); tree.nodes[9].next.push(2); const layout = layoutRoutePreview(tree);
  assert.equal(layout.nodes.length, 32); assert(layout.hasCycle); assert(Number.isFinite(layout.width));
  assert.equal(layoutRoutePreview({ roots: [], nodes: [] }).nodes.length, 0);
});
