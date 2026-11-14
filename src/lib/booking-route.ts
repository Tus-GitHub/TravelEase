export interface RoutePoint { lat: number; lng: number }
export interface BookingRoute {
  id: string;
  pickup: RoutePoint;
  drop: RoutePoint;
  roundTrip: boolean;
  distanceKm: number;
  durationHours: number;
  geometry: [number, number][];
  provider: "fossgis";
}
export function routePoint(value: unknown): RoutePoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (typeof p.lat !== "number" || typeof p.lng !== "number" || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return null;
  return { lat: Number(p.lat.toFixed(5)), lng: Number(p.lng.toFixed(5)) };
}
export function samePoint(a: RoutePoint, b: RoutePoint): boolean { return a.lat === b.lat && a.lng === b.lng; }
