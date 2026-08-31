/**
 * Map nodes for the Destinations section. `x`/`y` are hand-placed on the
 * stylised India silhouette (viewBox 0 0 440 520). `lat`/`lng` are real and
 * only used to derive geographic distance / rough drive time — never booking
 * data (vehicle counts + starting price come from `src/data/vehicles.ts`).
 */
export interface MapNode {
  id: string;
  name: string;
  state: string;
  tag: string;
  blurb: string;
  imageUrl: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export const mapNodes: MapNode[] = [
  {
    id: "leh",
    name: "Leh",
    state: "Ladakh",
    tag: "High Himalaya",
    blurb: "Monasteries, moonscapes and the world's highest motorable passes.",
    imageUrl: "https://images.unsplash.com/photo-1589553416260-f586c8f1514f?w=800&q=80",
    x: 252, y: 52, lat: 34.16, lng: 77.58,
  },
  {
    id: "manali",
    name: "Manali",
    state: "Himachal Pradesh",
    tag: "Mountain Escape",
    blurb: "Pine valleys, the Beas river and the gateway to Spiti.",
    imageUrl: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&q=80",
    x: 214, y: 84, lat: 32.24, lng: 77.19,
  },
  {
    id: "delhi",
    name: "Delhi",
    state: "Delhi NCR",
    tag: "Capital",
    blurb: "Mughal forts, wide boulevards and the start of the Golden Triangle.",
    imageUrl: "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=80",
    x: 210, y: 132, lat: 28.61, lng: 77.21,
  },
  {
    id: "jaipur",
    name: "Jaipur",
    state: "Rajasthan",
    tag: "Pink City",
    blurb: "Amber Fort, Hawa Mahal and colour-drenched bazaars.",
    imageUrl: "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&q=80",
    x: 172, y: 158, lat: 26.91, lng: 75.79,
  },
  {
    id: "udaipur",
    name: "Udaipur",
    state: "Rajasthan",
    tag: "City of Lakes",
    blurb: "Palaces mirrored in still water, ringed by the Aravalli hills.",
    imageUrl: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80",
    x: 148, y: 196, lat: 24.58, lng: 73.71,
  },
  {
    id: "varanasi",
    name: "Varanasi",
    state: "Uttar Pradesh",
    tag: "Ghats & Ritual",
    blurb: "Dawn boat rides and lamp-lit aarti on the Ganges.",
    imageUrl: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800&q=80",
    x: 286, y: 176, lat: 25.32, lng: 83.0,
  },
  {
    id: "mumbai",
    name: "Mumbai",
    state: "Maharashtra",
    tag: "Coastal Metro",
    blurb: "Art-deco seafronts, island causeways and late-night energy.",
    imageUrl: "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=800&q=80",
    x: 132, y: 292, lat: 19.08, lng: 72.88,
  },
  {
    id: "goa",
    name: "Goa",
    state: "Goa",
    tag: "Beaches",
    blurb: "Portuguese churches, palm coves and slow coastal roads.",
    imageUrl: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=80",
    x: 152, y: 344, lat: 15.3, lng: 74.09,
  },
  {
    id: "kochi",
    name: "Kochi",
    state: "Kerala",
    tag: "Backwaters",
    blurb: "Chinese fishing nets, spice lanes and the road to the backwaters.",
    imageUrl: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80",
    x: 186, y: 446, lat: 9.93, lng: 76.27,
  },
];

/** Great-circle distance in km. */
export function distanceKm(a: MapNode, b: MapNode): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/** Rough by-road drive time: distance is ~1.25× crow-flies at ~46 km/h + a buffer. */
export function driveTime(km: number): string {
  const hrs = (km * 1.25) / 46 + 0.6;
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return m >= 30 ? `${h + 1} hr` : `${h} hr`;
}
