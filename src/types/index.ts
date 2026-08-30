/**
 * Central domain model for the Travel Booking platform.
 * These interfaces mirror the future SQL tables (vehicles, categories,
 * reviews, users) so the mock `data/` layer maps 1:1 to API responses later.
 */

/** Name of an icon registered in the central Icon registry (`components/common/Icon.tsx`). */
export type IconName =
  | "bus"
  | "car"
  | "family"
  | "users"
  | "plane"
  | "shield-check"
  | "sofa"
  | "tag"
  | "headset"
  | "star"
  | "seat"
  | "map-pin"
  | "calendar"
  | "search"
  | "arrow-right"
  | "menu"
  | "close"
  | "phone"
  | "mail"
  | "location"
  | "facebook"
  | "twitter"
  | "instagram"
  | "linkedin"
  | "quote"
  | "check"
  | "snowflake"
  | "wifi"
  | "music"
  | "user"
  | "lock"
  | "chevron-down"
  | "logout"
  | "grid"
  | "eye"
  | "eye-off";

export interface NavLink {
  label: string;
  href: string;
}

export interface SocialLink {
  label: string;
  href: string;
  icon: IconName;
}

export interface VehicleCategory {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: IconName;
  imageUrl: string;
  href: string;
}

export interface Vehicle {
  id: string;
  name: string;
  type: string;
  imageUrl: string;
  seatingCapacity: number;
  features: string[];
  pricePerDay: number;
  rating: number;
  isAvailable: boolean;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: IconName;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  avatarUrl?: string;
  rating: number;
  quote: string;
}

export interface SearchFormData {
  pickupLocation: string;
  dropLocation: string;
  date: string;
  vehicleType: string;
}

export interface TouristSpot {
  id: string;
  name: string;
  imageUrl: string;
  tag: string; // e.g. "Heritage", "Beach", "Hill Station"
  description: string;
}

export interface Region {
  id: string;
  name: string;
  state: string;
  imageUrl: string;
  spots: TouristSpot[];
}

export type PackageTag = "Popular" | "Best Value" | "Premium" | "Adventure";

export interface TravelPackage {
  id: string;
  name: string;
  region: string;
  duration: number;        // days
  imageUrl: string;
  destinations: string[];  // ordered list of places
  vehicleType: string;
  maxPersons: number;
  highlights: string[];    // 3-4 key experiences
  pricePerPerson: number;  // INR
  rating: number;
  reviewCount: number;
  tag: PackageTag;
}
