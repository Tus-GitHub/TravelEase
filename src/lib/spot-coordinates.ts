/** Require a full pair on updates so partial PATCH requests cannot mix old/new pins. */
export function spotCoordinates(body: Record<string, unknown>): { latitude?: number | null; longitude?: number | null } {
  if (!("latitude" in body) && !("longitude" in body)) return {};
  const { latitude, longitude } = body;
  if (latitude === null && longitude === null) return { latitude, longitude };
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Set both coordinates within valid ranges, or clear both.");
  }
  return { latitude, longitude };
}
