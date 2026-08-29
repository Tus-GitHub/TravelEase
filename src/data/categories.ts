import type { VehicleCategory } from "@/types";

/** Bookable vehicle categories shown in the "Vehicle Categories" section. */
export const categories: VehicleCategory[] = [
  {
    id: "cat-tempo",
    slug: "tempo-traveller",
    title: "Tempo Traveller",
    description:
      "Spacious 9–26 seater vans, perfect for group tours, weddings and pilgrimages.",
    icon: "bus",
    imageUrl:
      "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=600&q=80",
    href: "/vehicles?category=tempo-traveller",
  },
  {
    id: "cat-luxury",
    slug: "luxury-cars",
    title: "Luxury Cars",
    description:
      "Premium sedans and SUVs with chauffeurs for business trips and special occasions.",
    icon: "car",
    imageUrl:
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80",
    href: "/vehicles?category=luxury-cars",
  },
  {
    id: "cat-family",
    slug: "family-cars",
    title: "Family Cars",
    description:
      "Comfortable hatchbacks and SUVs for safe, affordable family road trips.",
    icon: "family",
    imageUrl:
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&q=80",
    href: "/vehicles?category=family-cars",
  },
  {
    id: "cat-group",
    slug: "group-travel",
    title: "Group Travel",
    description:
      "Mini-buses and coaches for corporate outings, school trips and large groups.",
    icon: "users",
    imageUrl:
      "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&q=80",
    href: "/vehicles?category=group-travel",
  },
  {
    id: "cat-airport",
    slug: "airport-transfer",
    title: "Airport Transfer",
    description:
      "On-time pickups and drops with flight tracking and fixed, transparent fares.",
    icon: "plane",
    imageUrl:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80",
    href: "/vehicles?category=airport-transfer",
  },
];
