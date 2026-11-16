import type { Region, TouristSpot, TravelPackage } from "@/types";
import { geographyKey } from "./geography";

export interface DestinationCity {
  key: string;
  name: string;
  state: string;
  region: Region;
  spots: TouristSpot[];
}

/** Groups only published catalogue destinations; no invented booking IDs. */
export function destinationCities(regions: Region[]): DestinationCity[] {
  const groups = new Map<string, DestinationCity>();
  for (const region of regions) for (const spot of region.spots) {
    const name = spot.cityName?.trim() || spot.name;
    const state = spot.stateName?.trim() || region.state;
    const key = JSON.stringify([region.id, geographyKey(state), geographyKey(name)]);
    const city = groups.get(key) ?? { key, name, state, region, spots: [] };
    city.spots.push(spot);
    groups.set(key, city);
  }
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function cityPackages(packages: TravelPackage[], region?: Region, city?: DestinationCity, spot?: TouristSpot) {
  return packages.filter(pkg =>
    (!region || (pkg.regionId !== undefined ? String(pkg.regionId) === region.id : pkg.region === region.name)) &&
    (!spot || pkg.destinationIds?.includes(Number(spot.id))) &&
    (!city || city.spots.some(item => pkg.destinationIds?.includes(Number(item.id)))));
}

/** Select a representative spread on the country overview; all remain in search. */
export function featuredCities(cities: DestinationCity[], limit = 12): DestinationCity[] {
  const preferred = ["manali", "agra", "jaipur", "delhi", "varanasi", "mumbai", "panaji", "kochi", "khajuraho", "puri", "shillong", "gangtok", "dehradun"];
  const rank = (city: DestinationCity) => {
    const index = preferred.indexOf(geographyKey(city.name));
    return index < 0 ? preferred.length : index;
  };
  const sorted = [...cities].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const firstByRegion = Array.from(new Map(sorted.map(city => city.region.id).map(id => [id, sorted.find(city => city.region.id === id)!])).values());
  return [...firstByRegion, ...sorted.filter(city => !firstByRegion.includes(city))].slice(0, limit);
}

export type LandmarkKind = "mountain" | "palace" | "water" | "temple" | "gate" | "dome";
export function landmarkKind(name: string, tag = ""): LandmarkKind {
  const text = `${name} ${tag}`.toLowerCase();
  if (/agra|taj mahal/.test(text)) return "dome";
  if (/mountain|hill|manali|shimla|leh|dehradun|mussoorie|chakrata|darjeeling|shillong|gangtok/.test(text)) return "mountain";
  if (/jaipur|udaipur|mysuru|palace|fort|heritage/.test(text)) return "palace";
  if (/water|lake|beach|coast|kochi|panaji|mumbai|goa|puri/.test(text)) return "water";
  if (/temple|spiritual|varanasi|rishikesh|haridwar|khajuraho|guwahati/.test(text)) return "temple";
  return "gate";
}
