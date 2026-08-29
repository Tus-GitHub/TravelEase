import type { Vehicle } from "@/types";

/** Sample fleet shown in the "Featured Vehicles" section. */
export const vehicles: Vehicle[] = [
  {
    id: "veh-tempo-26",
    name: "Force Traveller 26-Seater",
    type: "Tempo Traveller",
    imageUrl:
      "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&q=80",
    seatingCapacity: 26,
    features: ["AC", "Pushback Seats", "LED TV", "Music System"],
    pricePerDay: 7500,
    rating: 4.8,
    isAvailable: true,
  },
  {
    id: "veh-merc-eclass",
    name: "Mercedes-Benz E-Class",
    type: "Luxury Car",
    imageUrl:
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
    seatingCapacity: 4,
    features: ["Chauffeur", "Leather Seats", "Wi-Fi", "Bottled Water"],
    pricePerDay: 9500,
    rating: 4.9,
    isAvailable: true,
  },
  {
    id: "veh-innova-crysta",
    name: "Toyota Innova Crysta",
    type: "Family Car",
    imageUrl:
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",
    seatingCapacity: 7,
    features: ["AC", "Spacious Boot", "Comfort Ride", "Music System"],
    pricePerDay: 4200,
    rating: 4.7,
    isAvailable: true,
  },
  {
    id: "veh-volvo-coach",
    name: "Volvo 9400 Coach",
    type: "Group Travel",
    imageUrl:
      "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80",
    seatingCapacity: 45,
    features: ["AC", "Reclining Seats", "Wi-Fi", "Charging Ports"],
    pricePerDay: 16500,
    rating: 4.8,
    isAvailable: true,
  },
  {
    id: "veh-bmw-5",
    name: "BMW 5 Series",
    type: "Luxury Car",
    imageUrl:
      "https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=800&q=80",
    seatingCapacity: 4,
    features: ["Chauffeur", "Sunroof", "Premium Audio", "Wi-Fi"],
    pricePerDay: 10500,
    rating: 4.9,
    isAvailable: false,
  },
  {
    id: "veh-ertiga",
    name: "Maruti Suzuki Ertiga",
    type: "Family Car",
    imageUrl:
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
    seatingCapacity: 7,
    features: ["AC", "Fuel Efficient", "Comfort Ride", "Boot Space"],
    pricePerDay: 3200,
    rating: 4.6,
    isAvailable: true,
  },
];
