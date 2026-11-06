import { categories } from "../data/categories";
import { features } from "../data/features";
import { aboutIntro, aboutStats, aboutStory } from "../data/pages";
import { catalogueFields, catalogueDefaults, validateCatalogueContent } from './cms-catalogue';

export const CMS_MAX_BYTES = 256 * 1024;
export const CMS_MAX_SECTIONS = 30;
export type CmsItem = Record<string, string>;
export type CmsValue = string | boolean | number | CmsItem[];
export type CmsContent = Record<string, CmsValue>;
export interface CmsAppearance { background: "default" | "light" | "muted" | "dark" | "image"; imageUrl: string; overlay: number }
export interface CmsSection { id: string; type: CmsSectionType; visible: boolean; appearance: CmsAppearance; content: CmsContent }
export interface CmsDocument {
  schemaVersion: 1;
  seo: { title: string; description: string };
  navigation: { header: boolean; footer: boolean; label: string; order: number };
  sections: CmsSection[];
}
export interface CmsField {
  key: string; label: string; type: "text" | "textarea" | "url" | "image" | "checkbox" | "number" | "select" | "items";
  max?: number; options?: readonly string[]; fields?: CmsField[];
}
interface SectionDefinition { label: string; description: string; repeatable: boolean; fields: CmsField[]; defaults: CmsContent }
const text = (key: string, label: string, max = 200): CmsField => ({ key, label, type: "text", max });
const paragraph = (key: string, label: string): CmsField => ({ key, label, type: "textarea", max: 12000 });
const url = (key: string, label: string): CmsField => ({ key, label, type: "url", max: 1000 });
const photo = (key: string, label: string): CmsField => ({ key, label, type: "image", max: 1000 });
const items = (fields: CmsField[]): CmsField => ({ key: "items", label: "Items", type: "items", fields, max: 20 });
const heading = [text("eyebrow", "Small heading"), text("title", "Heading"), paragraph("subtitle", "Introduction")];
export const CMS_ICONS = ["car", "bus", "family", "users", "plane", "shield-check", "sofa", "tag", "headset", "star", "map-pin", "calendar", "check", "arrow-right"];
const icon: CmsField = { key: "icon", label: "Icon", type: "select", options: CMS_ICONS };
const headingDefaults = (eyebrow: string, title: string, subtitle = "") => ({ eyebrow, title, subtitle });
export const CMS_SECTIONS = {
  catalogue: { label: 'Live catalogue', description: 'Choose Vehicles, Packages or Weekend Trips, curate the selection and choose the filters visitors can use.', repeatable: true,
    fields: [...heading, ...catalogueFields, text('buttonLabel', 'Button text'), url('buttonHref', 'Button link')], defaults: { ...headingDefaults('Explore together', 'Find your next journey'), ...catalogueDefaults, buttonLabel: 'View all Friday trips', buttonHref: '/weekend-trips' } },
  hero: { label: "Homepage hero", description: "Signature animated hero, photo option, search and calls to action.", repeatable: false,
    fields: [text("brand", "Brand line"), text("title", "Main headline"), text("highlight", "Highlighted headline"), paragraph("subtitle", "Introduction"), photo("imageUrl", "Hero photo (optional)"), text("imageAlt", "Photo description"), text("primaryLabel", "Main button text"), url("primaryHref", "Main button link"), text("secondaryLabel", "Second button text"), url("secondaryHref", "Second button link"), { key: "showSearch", label: "Show trip search", type: "checkbox" }, { key: "showVehicle", label: "Show hero photo or animated vehicle", type: "checkbox" }, items([text("value", "Value"), text("label", "Label")])],
    defaults: { brand: "Jagdamba Travellers", title: "Your journey.", highlight: "Elevated.", subtitle: "Chauffeur-driven journeys across India, engineered around you — verified drivers, transparent fares, one seamless booking.", imageUrl: "", imageAlt: "Chauffeur-driven travel", primaryLabel: "Explore the fleet", primaryHref: "/vehicles", secondaryLabel: "Build a trip", secondaryHref: "/booking", showSearch: true, showVehicle: true, items: [{ value: "500+", label: "Vehicles" }, { value: "50K+", label: "Journeys" }, { value: "120+", label: "Cities" }, { value: "4.9", label: "Avg. rating" }] } },
  "travel-band": { label: "Animated road", description: "The existing night-road illustration, or a full-width photograph.", repeatable: false,
    fields: [photo("imageUrl", "Replace illustration with photo"), text("imageAlt", "Photo description")], defaults: { imageUrl: "", imageAlt: "A journey across India" } },
  destinations: { label: "Destination map", description: "Interactive India route map with editable introduction.", repeatable: false,
    fields: heading, defaults: headingDefaults("Explore India", "Where will you go?", "Tap two cities to trace the route. Every journey is chauffeur-driven, door to door.") },
  "vehicle-categories": { label: "Vehicle categories", description: "Category cards with editable text, photographs and links.", repeatable: false,
    fields: [...heading, items([text("title", "Title"), paragraph("description", "Description"), icon, photo("imageUrl", "Photo"), url("href", "Link")])],
    defaults: { ...headingDefaults("Explore Options", "Find the Right Vehicle for Every Trip", "Whether it's a family getaway, a corporate offsite or an airport run, we have a category made for you."), items: categories.map(({ title, description, icon, imageUrl, href }) => ({ title, description, icon, imageUrl, href })) } },
  "featured-vehicles": { label: "Featured vehicles", description: "Available vehicles from the fleet. Pricing and photos stay managed in Fleet.", repeatable: false,
    fields: [...heading, text("buttonLabel", "Button text"), url("buttonHref", "Button link")], defaults: { ...headingDefaults("Choose your ride", "Designed for the journey", "Chauffeur-driven, immaculately kept, priced up front — pick the one that fits the trip."), buttonLabel: "View All Vehicles", buttonHref: "/vehicles" } },
  packages: { label: "Featured packages", description: "Live package cards with an editable heading and introduction.", repeatable: false,
    fields: heading, defaults: headingDefaults("Curated Journeys", "Travel packages, cinematically planned", "Multi-day routes with a dedicated chauffeur, handpicked stays and the driving sorted.") },
  "how-it-works": { label: "How it works", description: "The numbered journey timeline.", repeatable: false,
    fields: [...heading, items([text("n", "Step number"), text("title", "Title"), paragraph("body", "Description"), icon])],
    defaults: { ...headingDefaults("The Journey", "Four steps, one seamless trip", "From first idea to arrival — planned around you, driven for you."), items: [
      { n: "01", title: "Plan", body: "Tell us the route, the dates and the kind of vehicle. Get a transparent, all-in quote.", icon: "map-pin" },
      { n: "02", title: "Choose", body: "Compare chauffeur-driven options — sedans to coaches — with real photos and pricing.", icon: "car" },
      { n: "03", title: "Book", body: "Confirm in a tap. Book now, pay offline. Your driver's details arrive before pickup.", icon: "check" },
      { n: "04", title: "Travel", body: "Door to door with a verified driver. Change plans mid-trip? We adjust, no drama.", icon: "arrow-right" },
    ] } },
  "package-builder": { label: "Trip builder", description: "Existing package selection and custom trip builder, using live catalogue data.", repeatable: false,
    fields: heading, defaults: headingDefaults("Travel Packages", "Plan Your Perfect Trip", "Pick from our curated packages or build your very own — your trip, your way.") },
  features: { label: "Why choose us", description: "Trust and service feature cards.", repeatable: false,
    fields: [...heading, items([text("title", "Title"), paragraph("description", "Description"), icon])],
    defaults: { ...headingDefaults("Why Choose Us", "Travel With Total Peace of Mind", "We obsess over the details so your journey is safe, comfortable and completely hassle-free."), items: features.map(({ title, description, icon }) => ({ title, description, icon })) } },
  testimonials: { label: "Customer reviews", description: "Published customer reviews, with the existing fallback until enough reviews arrive.", repeatable: false,
    fields: heading, defaults: headingDefaults("Customer Experience", "Loved by Travellers Everywhere", "Real stories from people who booked their journeys with us.") },
  text: { label: "Text & statistics", description: "Page introduction, paragraphs and optional statistics.", repeatable: true,
    fields: [...heading, paragraph("body", "Body (blank line between paragraphs)"), items([text("value", "Value"), text("label", "Label")])], defaults: { ...headingDefaults("Our story", "A journey worth sharing"), body: "Tell your story here.", items: [] } },
  "image-text": { label: "Image & text", description: "A large photograph alongside your story and a button.", repeatable: true,
    fields: [...heading, paragraph("body", "Body"), photo("imageUrl", "Photo"), text("imageAlt", "Photo description"), { key: "imageSide", label: "Photo position", type: "select", options: ["left", "right"] }, text("buttonLabel", "Button text"), url("buttonHref", "Button link")], defaults: { ...headingDefaults("Discover more", "Made for your journey"), body: "Share what makes this experience special.", imageUrl: "", imageAlt: "", imageSide: "left", buttonLabel: "Contact us", buttonHref: "/contact" } },
  cards: { label: "Cards", description: "Photo cards for services, destinations or your team.", repeatable: true,
    fields: [...heading, items([text("title", "Title"), paragraph("body", "Description"), photo("imageUrl", "Photo"), text("imageAlt", "Photo description"), url("href", "Link (optional)")])], defaults: { ...headingDefaults("Explore", "More to discover"), items: [{ title: "Your first card", body: "Add a description.", imageUrl: "", imageAlt: "", href: "" }] } },
  timeline: { label: "Story timeline", description: "Milestones in the same layout as the About page.", repeatable: true,
    fields: [...heading, items([text("year", "Year / label"), text("title", "Title"), paragraph("body", "Description")])], defaults: { ...headingDefaults("Our Story", "How we got here"), items: aboutStory.map(item => ({ ...item })) } },
  faq: { label: "Questions & answers", description: "Expandable answers for a service or page.", repeatable: true,
    fields: [...heading, items([text("question", "Question", 300), paragraph("answer", "Answer")])], defaults: { ...headingDefaults("Good to know", "Your questions, answered"), items: [{ question: "How can we help?", answer: "Contact our team for help planning your journey." }] } },
  cta: { label: "Call to action", description: "A focused message and button.", repeatable: true,
    fields: [...heading, text("buttonLabel", "Button text"), url("buttonHref", "Button link")], defaults: { ...headingDefaults("Start exploring", "Ready for your next journey?", "Plan a trip with our team."), buttonLabel: "Plan my trip", buttonHref: "/booking" } },
} satisfies Record<string, SectionDefinition>;
export type CmsSectionType = keyof typeof CMS_SECTIONS;
export const CMS_TYPES = Object.keys(CMS_SECTIONS) as CmsSectionType[];
export const cmsDefinition = (type: CmsSectionType): SectionDefinition => CMS_SECTIONS[type];
export function newCmsSection(type: CmsSectionType, id = crypto.randomUUID()): CmsSection {
  return { id, type, visible: true, appearance: { background: "default", imageUrl: "", overlay: 50 }, content: structuredClone(CMS_SECTIONS[type].defaults) };
}
export const cmsText = (section: CmsSection | undefined, key: string, fallback = "") => typeof section?.content[key] === "string" ? section.content[key] as string : fallback;
export const cmsItems = (section: CmsSection | undefined): CmsItem[] | undefined => Array.isArray(section?.content.items) ? section.content.items as CmsItem[] : undefined;
export function cmsHeading(section?: CmsSection) {
  return section ? { cms: section, eyebrow: cmsText(section, "eyebrow"), title: cmsText(section, "title"), subtitle: cmsText(section, "subtitle") } : {};
}
export function cmsDefaultDocument(slug: string, title = "New page"): CmsDocument {
  const home = slug === "home", about = slug === "about";
  const types: CmsSectionType[] = home ? ["hero", "travel-band", "destinations", "vehicle-categories", "featured-vehicles", "packages", "how-it-works", "package-builder", "features", "testimonials"] : about ? ["text", "timeline", "features", "testimonials"] : ["text"];
  const document: CmsDocument = {
    schemaVersion: 1,
    seo: { title: home ? "Jagdamba Travellers" : about ? "About Jagdamba Travellers" : title, description: about ? "Why Jagdamba Travellers exists: chauffeur-driven trips across India with verified drivers and fully transparent fares." : "Chauffeur-driven journeys across India with Jagdamba Travellers." },
    navigation: { header: home || about, footer: home || about, label: home ? "Home" : about ? "About" : title.slice(0, 80), order: home ? 0 : 40 },
    sections: types.map((type, i) => newCmsSection(type, `${slug.slice(0, 60)}-${i + 1}`)),
  };
  if (about) document.sections[0] = { ...document.sections[0], appearance: { background: "muted", imageUrl: "", overlay: 50 }, content: { ...headingDefaults("About Us", "Travel across India, without the guesswork"), body: aboutIntro.join("\n\n"), items: aboutStats.map(item => ({ ...item })) } };
  if (!home && !about) document.sections[0].content.title = title;
  return document;
}

export class CmsError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = "CmsError"; this.status = status; }
}
const reserved = new Set(["api", "admin", "auth", "login", "signup", "forgot-password", "reset-password", "verify-email", "logout", "profile", "drive", "vehicles", "packages", "weekend-trips", "booking", "hotels", "contact", "help", "terms", "privacy", "policy", "cms-preview", "favicon", "robots", "sitemap", "_next", "images"]);
export const cmsPath = (slug: string) => slug === "home" ? "/" : `/${slug}`;
export function validateCmsSlug(value: unknown): string {
  if (typeof value !== "string" || value.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || reserved.has(value)) throw new CmsError("Choose a page address using lowercase letters, numbers and hyphens. This address may be reserved.");
  return value;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsError("Invalid page document.");
  return value as Record<string, unknown>;
};
function fieldsOnly(value: Record<string, unknown>, names: string[]) {
  if (Object.keys(value).some(key => !names.includes(key))) throw new CmsError("The page contains an unsupported field.");
}
function boundedText(value: unknown, max: number, label: string) {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new CmsError(`${label} must be text with at most ${max} characters.`);
  return value;
}
export function cmsSafeLink(value: string): boolean {
  if (!value) return true;
  if (/[\\\s\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  if (/^#[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) return true;
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
}
export function cmsSafeImage(value: string): boolean {
  if (!value) return true;
  if (/[\\\s"'<>\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !u.port &&
      (u.hostname === "images.unsplash.com" || (u.hostname === "res.cloudinary.com" && /^\/[^/]+\/image\/upload\//.test(u.pathname)));
  } catch { return false; }
}
function validateFields(input: unknown, fields: CmsField[]): CmsContent {
  const value = object(input); fieldsOnly(value, fields.map(field => field.key));
  const output: CmsContent = {};
  for (const field of fields) {
    const current = value[field.key];
    if (field.type === "items") {
      if (!Array.isArray(current) || current.length > (field.max ?? 20)) throw new CmsError(`${field.label} must contain at most ${field.max ?? 20} entries.`);
      output[field.key] = current.map(row => validateFields(row, field.fields ?? []) as CmsItem);
    } else if (field.type === "checkbox") {
      if (typeof current !== "boolean") throw new CmsError(`${field.label} must be on or off.`);
      output[field.key] = current;
    } else if (field.type === "number") {
      if (!Number.isSafeInteger(current) || Number(current) < 0 || Number(current) > (field.max ?? 100)) throw new CmsError(`Invalid ${field.label}.`);
      output[field.key] = Number(current);
    } else {
      const parsed = boundedText(current, field.max ?? 200, field.label);
      if (field.type === "select" && !field.options?.includes(parsed)) throw new CmsError(`Choose a valid ${field.label}.`);
      if (field.type === "url" && !cmsSafeLink(parsed)) throw new CmsError(`${field.label} must be a site path or HTTPS link.`);
      if (field.type === "image" && !cmsSafeImage(parsed)) throw new CmsError(`${field.label} must be an uploaded Cloudinary image or an Unsplash image.`);
      output[field.key] = parsed;
    }
  }
  return output;
}
export function validateCmsDocument(input: unknown): CmsDocument {
  const raw = object(input); fieldsOnly(raw, ["schemaVersion", "seo", "navigation", "sections"]);
  if (raw.schemaVersion !== 1) throw new CmsError("Unsupported page format. Reload the editor.");
  if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > CMS_MAX_BYTES) throw new CmsError("This page is too large. Reduce its content.", 413);
  const seo = object(raw.seo), nav = object(raw.navigation);
  fieldsOnly(seo, ["title", "description"]); fieldsOnly(nav, ["header", "footer", "label", "order"]);
  if (typeof nav.header !== "boolean" || typeof nav.footer !== "boolean" || !Number.isSafeInteger(nav.order) || Number(nav.order) < 0 || Number(nav.order) > 1000) throw new CmsError("Invalid navigation settings.");
  if (!Array.isArray(raw.sections) || !raw.sections.length || raw.sections.length > CMS_MAX_SECTIONS) throw new CmsError(`Use between 1 and ${CMS_MAX_SECTIONS} sections.`);
  const seen = new Set<string>(), unique = new Set<string>();
  const sections = raw.sections.map(inputSection => {
    const section = object(inputSection); fieldsOnly(section, ["id", "type", "visible", "appearance", "content"]);
    if (typeof section.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(section.id) || seen.has(section.id)) throw new CmsError("Every section needs a unique identifier.");
    seen.add(section.id);
    if (typeof section.type !== "string" || !Object.hasOwn(CMS_SECTIONS, section.type)) throw new CmsError("Unknown section type.");
    const type = section.type as CmsSectionType, definition = cmsDefinition(type);
    if (!definition.repeatable && unique.has(type)) throw new CmsError(`${definition.label} can appear once per page.`);
    unique.add(type);
    if (typeof section.visible !== "boolean") throw new CmsError("Invalid section visibility.");
    const appearance = object(section.appearance); fieldsOnly(appearance, ["background", "imageUrl", "overlay"]);
    const background = appearance.background as CmsAppearance["background"];
    if (!["default", "light", "muted", "dark", "image"].includes(background)) throw new CmsError("Choose a valid section background.");
    const imageUrl = boundedText(appearance.imageUrl, 1000, "Background image");
    if (!cmsSafeImage(imageUrl) || (background === "image" && !imageUrl)) throw new CmsError("Choose a valid background image.");
    if (!Number.isSafeInteger(appearance.overlay) || Number(appearance.overlay) < 0 || Number(appearance.overlay) > 90) throw new CmsError("Background overlay must be between 0 and 90.");
    const content = validateFields(section.content, definition.fields);
    if (type === 'catalogue') { try { validateCatalogueContent(content); } catch (error) { throw new CmsError((error as Error).message); } }
    return { id: section.id, type, visible: section.visible, appearance: { background, imageUrl, overlay: Number(appearance.overlay) }, content };
  });
  if (!sections.some(section => section.visible)) throw new CmsError("Keep at least one section visible.");
  const title = boundedText(seo.title, 200, "SEO title"), label = boundedText(nav.label, 80, "Navigation label");
  if (!title.trim() || ((nav.header || nav.footer) && !label.trim())) throw new CmsError("Enter the page title and navigation label.");
  return { schemaVersion: 1, seo: { title, description: boundedText(seo.description, 500, "SEO description") }, navigation: { header: nav.header, footer: nav.footer, label, order: Number(nav.order) }, sections };
}

/** Resolve only declared image fields; never use a client path to traverse arbitrary JSON. */
export function cmsDocumentWithImage(input: unknown, sectionId: string, target: string, imageUrl: string): CmsDocument {
  const document = object(structuredClone(input));
  if (!Array.isArray(document.sections)) throw new CmsError("Invalid page sections.");
  const section = document.sections.map(object).find(section => section.id === sectionId);
  if (!section || typeof section.type !== "string" || !Object.hasOwn(CMS_SECTIONS, section.type)) throw new CmsError("Image section not found.");
  if (target === "background") object(section.appearance).imageUrl = imageUrl;
  else {
    const definition = cmsDefinition(section.type as CmsSectionType);
    const match = /^items\.(\d+)\.([a-zA-Z]+)$/.exec(target);
    if (match) {
      const field = definition.fields.find(field => field.type === "items");
      const list = object(section.content).items;
      if (!Array.isArray(list) || !field?.fields?.some(field => field.key === match[2] && field.type === "image") || !list[Number(match[1])]) throw new CmsError("Invalid image field.");
      object(list[Number(match[1])])[match[2]] = imageUrl;
    } else {
      if (!definition.fields.some(field => field.key === target && field.type === "image")) throw new CmsError("Invalid image field.");
      object(section.content)[target] = imageUrl;
    }
  }
  return validateCmsDocument(document);
}
