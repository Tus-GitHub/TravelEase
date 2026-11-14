/** Small custom itineraries: preserve endpoints and evaluate every middle-stop order.
 * Costs are directed road travel times, never straight-line distances or prices.
 */
export const MAX_ROUTE_STOPS = 5;
export type RoadMatrix = (number | null)[][];
export interface RouteSuggestion {
  originalIds: number[];
  orderedIds: number[];
  originalSeconds: number;
  suggestedSeconds: number;
}

export function validateStopIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_ROUTE_STOPS ||
      value.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(value).size !== value.length) {
    throw new Error(`Choose 2 to ${MAX_ROUTE_STOPS} distinct tourist spots.`);
  }
  return value;
}

export function optimizeStopOrder(ids: number[], matrix: RoadMatrix): RouteSuggestion {
  validateStopIds(ids);
  const n = ids.length;
  if (!Array.isArray(matrix) || matrix.length !== n || matrix.some(row =>
    !Array.isArray(row) || row.length !== n || row.some(v => v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0)))) {
    throw new Error("The routing service returned invalid travel times.");
  }
  const cost = (order: number[]) => order.slice(1).reduce((sum, stop, i) => sum + (matrix[order[i]][stop] ?? Infinity), 0);
  let best = Array.from({ length: n }, (_, i) => i);
  const originalSeconds = cost(best);
  // Do not advertise a saving against an unreachable original itinerary.
  if (!Number.isFinite(originalSeconds)) throw new Error("Some selected stops cannot be connected by road in this order.");
  let suggestedSeconds = originalSeconds;
  function visit(order: number[], remaining: number[]) {
    if (!remaining.length) {
      const candidate = [0, ...order, n - 1];
      const seconds = cost(candidate);
      if (seconds < suggestedSeconds) { best = candidate; suggestedSeconds = seconds; }
      return;
    }
    for (const stop of remaining) visit([...order, stop], remaining.filter(i => i !== stop));
  }
  visit([], Array.from({ length: n - 2 }, (_, i) => i + 1));
  return { originalIds: [...ids], orderedIds: best.map(i => ids[i]), originalSeconds, suggestedSeconds };
}
