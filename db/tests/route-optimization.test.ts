import assert from "node:assert/strict";
import { optimizeStopOrder, validateStopIds } from "../../src/lib/route-optimization.ts";

const ids = [11, 22, 33, 44];
const matrix = [[0, 10, 1, 30], [40, 0, 10, 1], [40, 1, 0, 10], [40, 40, 40, 0]];
const result = optimizeStopOrder(ids, matrix);
assert.deepEqual(result.orderedIds, [11, 33, 22, 44]);
assert.equal(result.originalSeconds, 30);
assert.equal(result.suggestedSeconds, 3);
assert.deepEqual(ids, [11, 22, 33, 44]);
assert.deepEqual(optimizeStopOrder([1, 2], [[0, 5], [90, 0]]).orderedIds, [1, 2]);
assert.deepEqual(optimizeStopOrder(ids, matrix.map(row => row.map(() => 1))).orderedIds, ids);
for (const invalid of [[], [1], [1, 1], ["1", 2], [0, 2], [1, 2, 3, 4, 5, 6], [NaN, 2], [1.5, 2]]) {
  assert.throws(() => validateStopIds(invalid));
}
assert.throws(() => optimizeStopOrder(ids, [[0]]));
assert.throws(() => optimizeStopOrder([1, 2], [[0, -1], [1, 0]]));
assert.throws(() => optimizeStopOrder([1, 2], [[0, Infinity], [1, 0]]));
assert.throws(() => optimizeStopOrder([1, 2], [[0, null], [1, 0]]));
// Null on a different edge is not zero-cost travel.
const disconnectedAlternative = matrix.map(row => [...row]);
disconnectedAlternative[0][2] = null;
assert.deepEqual(optimizeStopOrder(ids, disconnectedAlternative).orderedIds, ids);
console.log("PASS: endpoint preservation, directed costs, exact reordering, stable ties, immutable inputs, limits and unreachable/malformed matrices.");
