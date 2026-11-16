import { validateTripContent, TripError, tripText, tripNumber, tripObject, type TripContent } from "./weekend-trips";
import { MEALS, emptyMeals, guestStay, type GuestStay, type MealCounts } from "./trip-plan";

export interface RouteNode { spotId: number; next: number[]; nights: number; extraPricePerPerson: number; description: string; meals: MealCounts; hotel?: GuestStay; canFinish: boolean }
export interface RouteTree { roots: number[]; nodes: RouteNode[] }
export interface PackageContent extends TripContent { version: 1; guideIncluded: boolean; routeTree?: RouteTree }
export interface SelectedRoute { stops: (RouteNode & { name: string })[]; days: number; nights: number; pricePerPerson: number; meals: MealCounts }
export interface PackagePlanSnapshot { version: 1; name: string; content: PackageContent; selectedRoute?: SelectedRoute; fingerprint: string }
export function blankPackageContent(): PackageContent {
  return { version: 1, summary: "", description: "", imageUrl: "", imageAlt: "", itinerary: [{ day: 1, title: "Your day plan", description: "", meals: [] }], inclusions: [], exclusions: [], stayNights: [], guideIncluded: false };
}
const ids = (value: unknown, label: string, limit: number) => {
  if (!Array.isArray(value) || value.length > limit) throw new TripError(`${label} supports up to ${limit} destinations.`);
  const result = value.map(id => tripNumber(id, label, 1, 2147483647));
  if (new Set(result).size !== result.length) throw new TripError(`${label} cannot contain duplicate destinations.`);
  return result;
};
export function validateRouteTree(value: unknown): RouteTree {
  const data = tripObject(value), roots = ids(data.roots, "Starting points", 8);
  if (!roots.length || !Array.isArray(data.nodes) || !data.nodes.length || data.nodes.length > 32) throw new TripError("Add a starting point and between one and 32 route destinations.");
  const nodes = data.nodes.map(value => {
    const node = tripObject(value), mealData = tripObject(node.meals ?? emptyMeals());
    if (typeof node.canFinish !== "boolean") throw new TripError("Choose where a route may finish.");
    let hotel: GuestStay | undefined; if (node.hotel !== undefined) { try { hotel = guestStay(node.hotel); } catch(error) { throw new TripError((error as Error).message); } }
    return { spotId: tripNumber(node.spotId, "Destination", 1, 2147483647), next: ids(node.next, "Next choices", 8),
      nights: tripNumber(node.nights, "Nights at destination", 0, 13), extraPricePerPerson: tripNumber(node.extraPricePerPerson, "Additional price per traveller", 0, 9999999.99, false),
      description: tripText(node.description ?? "", "Destination plan", 2000), meals: Object.fromEntries(MEALS.map(meal => [meal, tripNumber(mealData[meal] ?? 0, meal, 0, 28)])) as unknown as MealCounts,
      ...(hotel ? { hotel } : {}), canFinish: node.canFinish };
  });
  const byId = new Map(nodes.map(node => [node.spotId, node]));
  if (byId.size !== nodes.length) throw new TripError("Use each destination once in a route tree.");
  const parents = new Set<number>();
  for (const node of nodes) for (const next of node.next) {
    if (!byId.has(next) || next === node.spotId) throw new TripError("Every next choice must be another destination in this tree.");
    parents.add(next);
  }
  if (roots.some(id => !byId.has(id) || parents.has(id))) throw new TripError("Starting points must exist and cannot follow another destination.");
  const longest = new Map<number, number>(), visiting = new Set<number>();
  function visit(id: number): number {
    if (visiting.has(id)) throw new TripError("Remove the loop from the route tree.");
    if (longest.has(id)) return longest.get(id)!;
    const node = byId.get(id)!;
    if (!node.next.length && !node.canFinish) throw new TripError("A final destination must allow the customer to finish their route.");
    visiting.add(id);
    const nights = node.nights + Math.max(0, ...node.next.map(visit));
    if (nights > 13) throw new TripError("A route may include at most thirteen nights.");
    visiting.delete(id); longest.set(id, nights); return nights;
  }
  roots.forEach(id => visit(id));
  if (longest.size !== nodes.length) throw new TripError("Connect every destination to a starting point; remove disconnected branches or loops.");
  return { roots, nodes };
}
export function validatePackageContent(value: unknown): PackageContent | null {
  if (value === null) return null;
  const data = tripObject(value); if (data.version !== 1) throw new TripError("Unsupported package plan version.");
  const cleanLines = (value: unknown) => Array.isArray(value) ? value.filter(item => typeof item !== "string" || item.trim().length > 0) : value;
  const base = validateTripContent({ ...data, inclusions: cleanLines(data.inclusions), exclusions: cleanLines(data.exclusions), stayNights: [], guideIncluded: data.guideIncluded ?? false });
  return { ...base, version: 1, guideIncluded: base.guideIncluded ?? false, ...(data.routeTree ? { routeTree: validateRouteTree(data.routeTree) } : {}) };
}
export function routeRange(tree: RouteTree, basePrice: number) {
  const byId = new Map(tree.nodes.map(node => [node.spotId, node]));
  const memo = new Map<number, { minNights: number; maxNights: number; minExtra: number }>();
  function visit(id: number) {
    if (memo.has(id)) return memo.get(id)!;
    const node = byId.get(id)!;
    const range = { minNights: node.canFinish ? node.nights : Infinity, maxNights: node.canFinish ? node.nights : -Infinity, minExtra: node.canFinish ? node.extraPricePerPerson : Infinity };
    for (const next of node.next) {
      const child = visit(next);
      range.minNights = Math.min(range.minNights, node.nights + child.minNights);
      range.maxNights = Math.max(range.maxNights, node.nights + child.maxNights);
      range.minExtra = Math.min(range.minExtra, node.extraPricePerPerson + child.minExtra);
    }
    memo.set(id, range); return range;
  }
  const ranges = tree.roots.map(visit), minNights = Math.min(...ranges.map(range => range.minNights));
  return Number.isFinite(minNights) ? { minDays: minNights + 1, maxDays: Math.max(...ranges.map(range => range.maxNights)) + 1, minPrice: Math.round((basePrice + Math.min(...ranges.map(range => range.minExtra))) * 100) / 100 } : { minDays: 0, maxDays: 0, minPrice: 0 };
}
export function packagePlanDays(content: PackageContent | null | undefined, mode: string, price: number, duration: number) {
  if (!content) return duration;
  if (content.routeTree) {
    if (mode !== "private") throw new TripError("Guided route trees use private trips. Use a fixed package template for shared Friday departures.");
    return routeRange(content.routeTree, price).minDays;
  }
  if (!content.itinerary.length) throw new TripError("Add at least one day to the package itinerary.");
  if (content.itinerary[content.itinerary.length - 1].hotel && Object.values(content.itinerary[content.itinerary.length - 1].hotel!).some(Boolean)) throw new TripError("Add a checkout/return day after the final included hotel night.");
  return content.itinerary.length;
}
export function selectPackageRoute(tree: RouteTree, value: unknown, basePrice: number, names: Map<number, string>, requireFinish = true): SelectedRoute {
  const path = ids(value, "Selected route", 32);
  if (!path.length || !tree.roots.includes(path[0])) throw new TripError("Choose an available starting point.", 422);
  const byId = new Map(tree.nodes.map(node => [node.spotId, node]));
  const stops = path.map((id, i) => {
    const node = byId.get(id); if (!node || !names.has(id) || (i > 0 && !byId.get(path[i - 1])?.next.includes(id))) throw new TripError("This route has changed or a destination is unavailable. Choose your route again.", 409);
    return { ...node, name: names.get(id)! };
  });
  if (requireFinish && !stops[stops.length - 1].canFinish) throw new TripError("Choose the next destination before continuing to booking.", 422);
  const nights = stops.reduce((sum, node) => sum + node.nights, 0), pricePerPerson = Math.round((basePrice + stops.reduce((sum, node) => sum + node.extraPricePerPerson, 0)) * 100) / 100;
  return { stops, days: nights + 1, nights, pricePerPerson, meals: Object.fromEntries(MEALS.map(meal => [meal, stops.reduce((sum, node) => sum + node.meals[meal], 0)])) as unknown as MealCounts };
}
/** Hide branches without active destinations and a reachable admin-approved finish. */
export function availableRouteTree(tree: RouteTree, active: Set<number>): RouteTree {
  const byId = new Map(tree.nodes.map(node => [node.spotId, node])), viable = new Map<number, boolean>();
  function keep(id: number): boolean { if (viable.has(id)) return viable.get(id)!; const node = byId.get(id)!; const descendants = node.next.map(keep); const allowed = active.has(id) && (node.canFinish || descendants.some(Boolean)); viable.set(id, allowed); return allowed; }
  const roots = tree.roots.filter(keep), reachable = new Set<number>();
  function walk(id: number) { if (!viable.get(id) || reachable.has(id)) return; reachable.add(id); byId.get(id)!.next.forEach(walk); }
  roots.forEach(walk);
  return { roots, nodes: tree.nodes.filter(node => reachable.has(node.spotId)).map(node => ({ ...node, next: node.next.filter(id => reachable.has(id)) })) };
}
