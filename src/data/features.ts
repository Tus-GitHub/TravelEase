import type { Feature } from "@/types";

/** Trust-building points shown in the "Why Choose Us" section. */
export const features: Feature[] = [
  {
    id: "feat-drivers",
    title: "Verified Drivers",
    description:
      "Every driver is background-checked, licensed and rated by real travellers.",
    icon: "shield-check",
  },
  {
    id: "feat-comfort",
    title: "Comfortable Vehicles",
    description:
      "Well-maintained, sanitised and air-conditioned vehicles for every trip.",
    icon: "sofa",
  },
  {
    id: "feat-pricing",
    title: "Affordable Pricing",
    description:
      "Transparent, upfront fares with no hidden charges or surprise fees.",
    icon: "tag",
  },
  {
    id: "feat-support",
    title: "24/7 Support",
    description:
      "Our travel experts are available round the clock, before and during your ride.",
    icon: "headset",
  },
];
