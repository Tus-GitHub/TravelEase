import type { CmsDocument, CmsSection } from "./cms";

/** Explicit homepage content update, also used for new homepage templates.
 * Never applied on reads: subsequent admin edits remain authoritative. */
export function packageFirstHomepage(document: CmsDocument): CmsDocument {
  const next = structuredClone(document);
  next.seo.description = "Ready-made travel packages, weekend group trips and custom itineraries across India with Jagdamba Travellers.";
  const patches: Partial<Record<CmsSection["type"], Record<string, unknown>>> = {
    hero: { title: "Less planning.", highlight: "More memories.", subtitle: "Ready-made getaways, weekend groups and trips shaped around you. Explore the itinerary, see what is included and make room for the memories.", primaryLabel: "Explore packages", primaryHref: "/packages", secondaryLabel: "Weekend group trips", secondaryHref: "/weekend-trips", showSearch: false, showVehicle: true, imageAlt: "Travel with Jagdamba Travellers", items: [{ value: "Planned", label: "Packages" }, { value: "Together", label: "Weekend trips" }, { value: "Your way", label: "Custom routes" }] },
    packages: { eyebrow: "Ready-made getaways", title: "Start with a travel package", subtitle: "Explore the itinerary, stays, meals and activities listed in each package before you book." },
    "package-builder": { eyebrow: "Make it your own", title: "Choose a package or shape your own trip", subtitle: "Choose a ready-made itinerary or build your own route from published destinations. Review the price and inclusions before booking." },
    "featured-vehicles": { eyebrow: "Travel together", title: "The right vehicle for your getaway", subtitle: "Choose your group’s vehicle, then explore suitable packages or create your own trip.", buttonLabel: "Explore trip vehicles", buttonHref: "/vehicles" },
    "how-it-works": { eyebrow: "From idea to getaway", title: "Your trip, in a few simple steps", subtitle: "Choose the experience first. We show the details before you commit.", items: [{ n: "01", title: "Find your trip", body: "Choose a ready-made package, weekend group departure or guided custom route.", icon: "map-pin" }, { n: "02", title: "Make it yours", body: "Review the day plan, listed stays, meals, guide arrangements and additional costs.", icon: "calendar" }, { n: "03", title: "Request your booking", body: "Add your dates, travellers and contact number. Review the full quote before submitting.", icon: "check" }, { n: "04", title: "Get ready to travel", body: "Follow the payment instructions. Our team confirms your booking and coordinates your trip.", icon: "users" }] },
    features: { title: "Know your trip before you book", subtitle: "Clear plans, visible inclusions and a team to coordinate your getaway.", items: [{ icon: "map-pin", title: "Planned itineraries", description: "See the day-by-day route and activities provided for your package." }, { icon: "users", title: "Private or together", description: "Plan a private getaway or join a scheduled weekend group." }, { icon: "tag", title: "Clear inclusions", description: "Review the listed stays, meals and exclusions before booking." }, { icon: "headset", title: "Trip coordination", description: "Share your contact number so our team can arrange the details with you." }] },
  };
  for (const section of next.sections) {
    if (patches[section.type]) section.content = { ...section.content, ...patches[section.type] } as CmsSection["content"];
    // Keep legacy sections editable without leading with cab routes or categories.
    if (["travel-band", "destinations", "vehicle-categories"].includes(section.type)) section.visible = false;
  }
  if (!next.sections.some(section => section.type === "catalogue" && section.content.source === "weekend-trips")) {
    next.sections.push({ id: "home-weekend-trips", type: "catalogue", visible: true, appearance: { background: "default", imageUrl: "", overlay: 50 }, content: { source: "weekend-trips", title: "Weekend Trips", eyebrow: "Friday, together", subtitle: "Meet new people and explore somewhere new. Choose a scheduled group departure.", count: 6, layout: "grid", sort: "recommended", empty: "message", emptyMessage: "Our next group trips are being planned. Check back soon for dates and pickup cities.", buttonLabel: "Explore weekend trips", buttonHref: "/weekend-trips", from: "", to: "", pickup: 0, region: 0, category: "", minPrice: 0, maxPrice: 0, minSeats: 0, featuredOnly: false, availableOnly: false, showDates: true, showPickup: true, showSearch: false, showBudget: false, showRegion: false, showCategory: false, showSeats: false, showSort: false } });
  }
  const priority = (section: CmsSection) => section.type === "hero" ? 0 : section.type === "featured-vehicles" ? 1 : section.type === "packages" ? 2 : section.type === "catalogue" && section.content.source === "weekend-trips" ? 3 : section.type === "package-builder" ? 4 : section.type === "how-it-works" ? 5 : 6;
  next.sections.sort((a, b) => priority(a) - priority(b));
  return next;
}

/** One-time content change: preserve all admin copy and unrelated sections. */
export function prioritiseTripVehicles(document: CmsDocument): CmsDocument {
  const next = structuredClone(document);
  const vehicles = next.sections.filter(section => section.type === "featured-vehicles");
  next.sections = next.sections.filter(section => section.type !== "featured-vehicles");
  for (const section of vehicles) section.visible = true;
  const heroIndex = next.sections.findIndex(section => section.type === "hero" && section.visible);
  next.sections.splice(heroIndex >= 0 ? heroIndex + 1 : 0, 0, ...vehicles);
  for (const section of next.sections) if (section.type === "package-builder") section.content.subtitle = "Choose a ready-made itinerary or build your own route from published destinations. Review the price and inclusions before booking.";
  return next;
}
