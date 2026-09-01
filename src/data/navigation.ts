import type { NavLink, SocialLink } from "@/types";

/** Primary navbar links. */
export const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Vehicles", href: "/vehicles" },
  { label: "Packages", href: "/packages" },
  { label: "Booking", href: "/booking" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/** Footer link groups — each becomes a column. */
export const footerLinkGroups: { title: string; links: NavLink[] }[] = [
  {
    title: "Quick Links",
    links: [
      { label: "Home", href: "/" },
      { label: "Vehicles", href: "/vehicles" },
      { label: "Packages", href: "/packages" },
      { label: "Booking", href: "/booking" },
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Vehicle Types",
    links: [
      { label: "Tempo Traveller", href: "/vehicles?category=tempo-traveller" },
      { label: "Luxury Cars", href: "/vehicles?category=luxury-cars" },
      { label: "Family Cars", href: "/vehicles?category=family-cars" },
      { label: "Group Travel", href: "/vehicles?category=group-travel" },
      { label: "Airport Transfer", href: "/vehicles?category=airport-transfer" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Cancellation Policy", href: "/policy/cancellation" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
];

/** Social media links shown in the footer. */
export const socialLinks: SocialLink[] = [
  { label: "Facebook", href: "https://facebook.com", icon: "facebook" },
  { label: "Twitter", href: "https://twitter.com", icon: "twitter" },
  { label: "Instagram", href: "https://instagram.com", icon: "instagram" },
  { label: "LinkedIn", href: "https://linkedin.com", icon: "linkedin" },
];
