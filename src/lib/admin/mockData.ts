/**
 * Placeholder data for the admin panel's first UI pass. Deliberately separate
 * from `src/data/*.ts` (the real public-site content) — nothing here is
 * persisted or wired to the database yet.
 *
 * Shapes below mirror the real SQL Server schema (chunk 1.2 in plan.md, 9
 * tables: VehicleTypes, Vehicles, VehicleImages, Regions, Cities,
 * TouristSpots, Packages, PackageStops — CustomerProfiles has no admin UI
 * yet) so this UI previews the eventual real data, including foreign-key
 * relationships (e.g. a vehicle references a vehicle type by id).
 */

export type AdminRole = "customer" | "agent" | "admin";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AdminRole;
  joinedAt: string;
}

export const mockUsers: AdminUserRow[] = [
  { id: "u1", name: "Priya Menon", email: "priya.menon@example.com", phone: "9812345001", role: "admin", joinedAt: "2026-05-12" },
  { id: "u2", name: "Arjun Rao", email: "arjun.rao@example.com", phone: "9812345002", role: "agent", joinedAt: "2026-06-02" },
  { id: "u3", name: "Fatima Sheikh", email: "fatima.sheikh@example.com", phone: "9812345003", role: "customer", joinedAt: "2026-06-20" },
  { id: "u4", name: "Vikram Desai", email: "vikram.desai@example.com", phone: "9812345004", role: "customer", joinedAt: "2026-07-08" },
  { id: "u5", name: "Neha Kapoor", email: "neha.kapoor@example.com", phone: "9812345005", role: "agent", joinedAt: "2026-08-01" },
  { id: "u6", name: "Rohit Bansal", email: "rohit.bansal@example.com", phone: "9812345006", role: "customer", joinedAt: "2026-08-24" },
  { id: "u7", name: "Sara Iyer", email: "sara.iyer@example.com", phone: "9812345007", role: "customer", joinedAt: "2026-08-27" },
];

// ─── Fleet: VehicleTypes → Vehicles → VehicleImages ─────────────────────────

export interface AdminVehicleTypeRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
}

export const mockVehicleTypes: AdminVehicleTypeRow[] = [
  { id: "vt1", slug: "tempo-traveller", title: "Tempo Traveller", description: "Spacious 12-26 seaters for group trips", displayOrder: 1, isActive: true },
  { id: "vt2", slug: "sedan", title: "Sedan", description: "Comfortable 4-seaters for city rides", displayOrder: 2, isActive: true },
  { id: "vt3", slug: "suv", title: "SUV", description: "7-seater SUVs for family trips", displayOrder: 3, isActive: true },
  { id: "vt4", slug: "luxury-car", title: "Luxury Car", description: "Premium chauffeur-driven cars", displayOrder: 4, isActive: true },
  { id: "vt5", slug: "group-travel", title: "Group Travel", description: "Large coaches for 26+ passengers", displayOrder: 5, isActive: false },
];

export interface AdminVehicleImage {
  url: string;
  isPrimary: boolean;
}

export interface AdminVehicleRow {
  id: string;
  vehicleTypeId: string;
  name: string;
  registrationNumber: string;
  seatingCapacity: number;
  features: string[];
  basePricePerDay: number;
  rating: number;
  isAvailable: boolean;
  images: AdminVehicleImage[];
}

export const mockVehicles: AdminVehicleRow[] = [
  { id: "v1", vehicleTypeId: "vt1", name: "Tempo Traveller 17-Seater", registrationNumber: "KA01AB1234", seatingCapacity: 17, features: ["AC", "Pushback Seats", "Music System"], basePricePerDay: 6800, rating: 4.6, isAvailable: true, images: [{ url: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=400&q=80", isPrimary: true }] },
  { id: "v2", vehicleTypeId: "vt2", name: "Honda City", registrationNumber: "MH12CD5678", seatingCapacity: 4, features: ["AC", "Bluetooth"], basePricePerDay: 3200, rating: 4.5, isAvailable: true, images: [] },
  { id: "v3", vehicleTypeId: "vt3", name: "Mahindra Scorpio", registrationNumber: "DL05EF9012", seatingCapacity: 7, features: ["AC", "Spacious Boot"], basePricePerDay: 4600, rating: 4.4, isAvailable: false, images: [] },
  { id: "v4", vehicleTypeId: "vt4", name: "BMW 5 Series", registrationNumber: "KA03GH3456", seatingCapacity: 4, features: ["Chauffeur", "Leather Seats", "Wi-Fi"], basePricePerDay: 11500, rating: 4.9, isAvailable: true, images: [{ url: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&q=80", isPrimary: true }] },
  { id: "v5", vehicleTypeId: "vt1", name: "Force Traveller 12-Seater", registrationNumber: "TN09IJ7890", seatingCapacity: 12, features: ["AC", "LED TV"], basePricePerDay: 5400, rating: 4.3, isAvailable: true, images: [] },
];

// ─── Geography: Regions → Cities → TouristSpots ─────────────────────────────

export interface AdminRegionRow {
  id: string;
  name: string;
  state: string;
  isActive: boolean;
}

export const mockRegions: AdminRegionRow[] = [
  { id: "r1", name: "Coorg", state: "Karnataka", isActive: true },
  { id: "r2", name: "Ladakh", state: "Ladakh", isActive: true },
  { id: "r3", name: "Udaipur", state: "Rajasthan", isActive: true },
  { id: "r4", name: "Andaman", state: "Andaman & Nicobar", isActive: true },
  { id: "r5", name: "Rishikesh", state: "Uttarakhand", isActive: false },
];

export interface AdminCityRow {
  id: string;
  regionId: string;
  name: string;
  latitude: number;
  longitude: number;
  isPickupPoint: boolean;
  isAirport: boolean;
}

export const mockCities: AdminCityRow[] = [
  { id: "c1", regionId: "r1", name: "Madikeri", latitude: 12.4244, longitude: 75.7382, isPickupPoint: true, isAirport: false },
  { id: "c2", regionId: "r2", name: "Leh", latitude: 34.1526, longitude: 77.5771, isPickupPoint: true, isAirport: true },
  { id: "c3", regionId: "r3", name: "Udaipur City", latitude: 24.5854, longitude: 73.7125, isPickupPoint: true, isAirport: true },
  { id: "c4", regionId: "r4", name: "Port Blair", latitude: 11.6234, longitude: 92.7265, isPickupPoint: true, isAirport: true },
  { id: "c5", regionId: "r5", name: "Rishikesh Town", latitude: 30.0869, longitude: 78.2676, isPickupPoint: false, isAirport: false },
];

export interface AdminTouristSpotRow {
  id: string;
  cityId: string;
  name: string;
  tag: string;
  displayOrder: number;
}

export const mockTouristSpots: AdminTouristSpotRow[] = [
  { id: "ts1", cityId: "c1", name: "Abbey Falls", tag: "Waterfall", displayOrder: 1 },
  { id: "ts2", cityId: "c1", name: "Raja's Seat", tag: "Viewpoint", displayOrder: 2 },
  { id: "ts3", cityId: "c2", name: "Pangong Lake", tag: "Lake", displayOrder: 1 },
  { id: "ts4", cityId: "c3", name: "City Palace", tag: "Heritage", displayOrder: 1 },
  { id: "ts5", cityId: "c3", name: "Lake Pichola", tag: "Lake", displayOrder: 2 },
  { id: "ts6", cityId: "c4", name: "Radhanagar Beach", tag: "Beach", displayOrder: 1 },
];

// ─── Catalog: Packages → PackageStops ───────────────────────────────────────

export type AdminPackageTag = "Popular" | "Best Value" | "Premium" | "Adventure";

export interface AdminPackageStop {
  touristSpotId: string;
  stopOrder: number;
  nightsHere: number;
}

export interface AdminPackageRow {
  id: string;
  regionId: string;
  vehicleTypeId: string;
  name: string;
  durationDays: number;
  maxPersons: number;
  pricePerPerson: number;
  tag: AdminPackageTag;
  rating: number;
  stops: AdminPackageStop[];
}

export const mockPackages: AdminPackageRow[] = [
  { id: "p1", regionId: "r1", vehicleTypeId: "vt3", name: "Coorg Coffee Trail", durationDays: 4, maxPersons: 6, pricePerPerson: 8200, tag: "Best Value", rating: 4.7, stops: [{ touristSpotId: "ts1", stopOrder: 1, nightsHere: 1 }, { touristSpotId: "ts2", stopOrder: 2, nightsHere: 2 }] },
  { id: "p2", regionId: "r2", vehicleTypeId: "vt1", name: "Ladakh Bike Expedition", durationDays: 9, maxPersons: 10, pricePerPerson: 24500, tag: "Adventure", rating: 4.8, stops: [{ touristSpotId: "ts3", stopOrder: 1, nightsHere: 3 }] },
  { id: "p3", regionId: "r3", vehicleTypeId: "vt4", name: "Udaipur Royal Retreat", durationDays: 5, maxPersons: 4, pricePerPerson: 18999, tag: "Premium", rating: 4.9, stops: [{ touristSpotId: "ts4", stopOrder: 1, nightsHere: 2 }, { touristSpotId: "ts5", stopOrder: 2, nightsHere: 2 }] },
  { id: "p4", regionId: "r4", vehicleTypeId: "vt3", name: "Andaman Island Hopper", durationDays: 6, maxPersons: 8, pricePerPerson: 21000, tag: "Popular", rating: 4.6, stops: [{ touristSpotId: "ts6", stopOrder: 1, nightsHere: 3 }] },
  { id: "p5", regionId: "r5", vehicleTypeId: "vt2", name: "Rishikesh Weekend Escape", durationDays: 3, maxPersons: 4, pricePerPerson: 5499, tag: "Popular", rating: 4.5, stops: [] },
];
