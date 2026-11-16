import type { NavLink, SocialLink } from "@/types";

/** Primary navbar links. */
export const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Vehicles", href: "/vehicles" },
  { label: "Packages", href: "/packages" },
  { label: "Weekend Trips", href: "/weekend-trips" },
  { label: "Build Your Trip", href: "/booking?mode=custom" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/** Footer link groups — each becomes a column. */
export const footerLinkGroups: { title: string; links: NavLink[] }[] = [
  {
    title: "Quick Links",
    links: [
      { label: "Home", href: "/" },
      { label: "Packages", href: "/packages" },
      { label: "Weekend Trips", href: "/weekend-trips" },
      { label: "Hotels", href: "/hotels" },
      { label: "Build Your Trip", href: "/booking?mode=custom" },
      { label: "Vehicles", href: "/vehicles" },
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Travel with us",
    links: [
      { label: "Tempo Traveller", href: "/vehicles?category=tempo-traveller" },
      { label: "Luxury Cars", href: "/vehicles?category=luxury-cars" },
      { label: "Family Cars", href: "/vehicles?category=family-cars" },
      { label: "Group Travel", href: "/vehicles?category=group-travel" },
      { label: "Point-to-point transfers", href: "/booking/new?type=point_to_point" },
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
