import type { CmsContent, CmsField, CmsSection } from './cms';
import type { PublicTrip } from './weekend-public';

export const catalogueSources = ['weekend-trips', 'vehicles', 'packages'] as const;
export type CatalogueSource = typeof catalogueSources[number];
export const sourceLabels: Record<CatalogueSource, string> = { 'weekend-trips': 'Weekend Trips', vehicles: 'Vehicles', packages: 'Packages' };
const number = (key: string, label: string, max: number): CmsField => ({ key, label, type: 'number', max });
const toggle = (key: string, label: string): CmsField => ({ key, label, type: 'checkbox' });
export const catalogueFields: CmsField[] = [
  { key: 'source', label: 'Content source', type: 'select', options: catalogueSources },
  { key: 'layout', label: 'Card layout', type: 'select', options: ['grid', 'list'] },
  { key: 'category', label: 'Vehicle category', type: 'text', max: 160 },
  number('region', 'Destination region', 2147483647), number('pickup', 'Pickup city', 2147483647),
  { key: 'from', label: 'Departures from', type: 'text', max: 10 }, { key: 'to', label: 'Departures until', type: 'text', max: 10 },
  number('minPrice', 'Minimum price (₹)', 99999999), number('maxPrice', 'Maximum price (₹, 0 = any)', 99999999), number('minSeats', 'Minimum seats / group capacity', 100),
  toggle('availableOnly', 'Only available to book'), toggle('featuredOnly', 'Only featured trips'),
  toggle('showSearch', 'Show search'), toggle('showCategory', 'Show category filter'), toggle('showRegion', 'Show destination filter'),
  toggle('showPickup', 'Show pickup filter'), toggle('showDates', 'Show departure date filters'), toggle('showBudget', 'Show budget filter'), toggle('showSeats', 'Show group-size filter'), toggle('showSort', 'Show sort control'),
  { key: 'sort', label: 'Default order', type: 'select', options: ['recommended', 'price-low', 'price-high', 'name'] },
  number('count', 'Maximum cards', 24),
  { key: 'empty', label: 'When no records match', type: 'select', options: ['message', 'hide'] },
  { key: 'emptyMessage', label: 'Empty message', type: 'text', max: 300 },
];
export const catalogueDefaults: CmsContent = { source: 'weekend-trips', layout: 'grid', category: '', region: 0, pickup: 0, from: '', to: '', minPrice: 0, maxPrice: 0, minSeats: 0, availableOnly: false, featuredOnly: false, showSearch: false, showCategory: false, showRegion: false, showPickup: false, showDates: false, showBudget: false, showSeats: false, showSort: false, sort: 'recommended', count: 6, empty: 'message', emptyMessage: 'More journeys are on their way. Please check back soon.' };
export function catalogueFieldApplies(key: string, source: string) {
  if (['category', 'showCategory'].includes(key)) return source === 'vehicles';
  if (['region', 'showRegion'].includes(key)) return source !== 'vehicles';
  if (['pickup', 'from', 'to', 'featuredOnly', 'showPickup', 'showDates'].includes(key)) return source === 'weekend-trips';
  if (key === 'availableOnly') return source !== 'packages';
  return true;
}
export function validateCatalogueContent(c: CmsContent) {
  if (Number(c.count) < 1) throw Error('Show between 1 and 24 cards.');
  if (c.maxPrice && Number(c.minPrice) > Number(c.maxPrice)) throw Error('Maximum price must be at least the minimum price.');
  if (c.category && !/^[a-z0-9-]{1,160}$/.test(String(c.category))) throw Error('Choose a valid vehicle category.');
  for (const key of ['from', 'to']) if (c[key]) {
    const value = String(c[key]);
    if (!/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw Error('Choose a valid departure date.');
  }
  if (c.from && c.to && c.from > c.to) throw Error('The departure end date must follow the start date.');
  for (const field of catalogueFields) if (!catalogueFieldApplies(field.key, String(c.source)) && c[field.key] !== catalogueDefaults[field.key]) throw Error(`${field.label} is not available for this content source.`);
}
export interface CatalogueRow {
  id: string; title: string; href: string; image: string; description: string;
  price: number; priceLabel: string; seats: number; available: boolean; featured: boolean;
  category: string; categoryLabel: string; region: number; regionLabel: string; pickup: number; pickupLabel: string; date: string; rating: number;
}
export interface CatalogueFilters { search?: string; category?: string; region?: number; pickup?: number; from?: string; to?: string; minPrice?: number; maxPrice?: number; minSeats?: number; availableOnly?: boolean; featuredOnly?: boolean }
export function catalogueFilters(c: CmsContent): CatalogueFilters {
  return { category: String(c.category), region: Number(c.region), pickup: Number(c.pickup), from: String(c.from), to: String(c.to), minPrice: Number(c.minPrice), maxPrice: Number(c.maxPrice), minSeats: Number(c.minSeats), availableOnly: c.availableOnly === true, featuredOnly: c.featuredOnly === true };
}
export function filterCatalogue(rows: CatalogueRow[], f: CatalogueFilters): CatalogueRow[] {
  return rows.filter(r => (!f.search || `${r.title} ${r.description} ${r.regionLabel} ${r.pickupLabel}`.toLowerCase().includes(f.search.trim().toLowerCase())) &&
    (!f.category || r.category === f.category) && (!f.region || r.region === f.region) && (!f.pickup || r.pickup === f.pickup) &&
    (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && (!f.minPrice || r.price >= f.minPrice) && (!f.maxPrice || r.price <= f.maxPrice) &&
    (!f.minSeats || r.seats >= f.minSeats) && (!f.availableOnly || r.available) && (!f.featuredOnly || r.featured));
}
export function sortCatalogue(rows: CatalogueRow[], sort: string, source: string) {
  return [...rows].sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : sort === 'name' ? a.title.localeCompare(b.title) : source === 'weekend-trips' ? a.date.localeCompare(b.date) : b.rating - a.rating);
}
export function tripCatalogueRow(t: PublicTrip): CatalogueRow {
  return { id: t.id, title: t.title, href: `/weekend-trips/${t.slug}`, image: t.content.imageUrl, description: t.content.summary, price: t.pricePerPerson, priceLabel: 'per person · inclusions & taxes included', seats: t.availableSeats, available: t.bookable && t.availableSeats > 0, featured: t.isFeatured, category: '', categoryLabel: '', region: t.regionId, regionLabel: t.region, pickup: t.pickupCityId, pickupLabel: t.pickupCity, date: new Date(Date.parse(t.startsAt) + 330 * 60000).toISOString().slice(0, 10), rating: 0 };
}
export function tripCatalogueQuery(c: CmsContent): URLSearchParams {
  const p = new URLSearchParams();
  for (const [key, target] of [['region', 'regionId'], ['pickup', 'cityId'], ['from', 'from'], ['to', 'to'], ['minPrice', 'minPrice'], ['maxPrice', 'maxPrice'], ['minSeats', 'seats']]) if (c[key]) p.set(target, String(c[key]));
  if (c.featuredOnly) p.set('featured', 'true');
  if (c.sort === 'price-low' || c.sort === 'price-high') p.set('sort', c.sort);
  return p;
}
export function cmsSectionAnchor(s: CmsSection) {
  const fixed: Partial<Record<CmsSection['type'], string>> = { 'featured-vehicles': 'featured', 'package-builder': 'build-package', features: 'why-us', testimonials: 'reviews', 'vehicle-categories': 'vehicles' };
  return '#' + (fixed[s.type] || `section-${s.id}`);
}
export interface CmsDestination { href: string; label: string; kind: 'page' | 'vehicles' | 'packages' | 'weekend-trips' }
export interface CmsOptions { destinations: CmsDestination[]; categories: { value: string; label: string }[]; regions: { value: number; label: string }[]; cities: { value: number; label: string }[] }
