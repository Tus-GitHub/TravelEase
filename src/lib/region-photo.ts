import { isDestinationPhoto } from "./destination-photo";

interface PhotoSpot { name: string; cityName?: string; imageUrl: string | null }
const preferredCities: Record<string, string> = {
  north: "Agra", "north east": "Shillong", east: "Kolkata",
  central: "Khajuraho", west: "Mumbai", south: "Mysuru",
};

/** Admin photos win. Otherwise use a real, active place within this region. */
export function regionPhoto(region: { name: string; imageUrl: string | null; spots: PhotoSpot[] }): string {
  if (region.imageUrl?.trim()) return region.imageUrl;
  const preferred = preferredCities[region.name.trim().toLowerCase().replace(/[-\s]+/g, " ")];
  const photos = region.spots.filter(spot => isDestinationPhoto(spot.imageUrl));
  return photos.find(spot => spot.cityName === preferred)?.imageUrl
    ?? photos[0]?.imageUrl
    ?? region.spots.find(spot => spot.imageUrl?.trim())?.imageUrl
    ?? "/images/destination-illustration.svg";
}
