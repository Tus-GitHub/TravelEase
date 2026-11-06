import { getPool } from './db';
import { listPublicVehicles, listPublicPackages, listPublicVehicleTypes, VEHICLE_IMAGE_FALLBACK, PACKAGE_IMAGE_FALLBACK } from './catalogue';
import { listPublicTrips, readTripFilters } from './weekend-public';
import { cmsPath, CmsError, type CmsContent } from '../cms';
import { catalogueFilters, filterCatalogue, tripCatalogueRow, tripCatalogueQuery, type CatalogueRow, type CmsOptions } from '../cms-catalogue';

export async function loadCatalogue(c: CmsContent): Promise<CatalogueRow[]> {
  let rows: CatalogueRow[];
  if (c.source === 'weekend-trips') rows = (await listPublicTrips(readTripFilters(Object.fromEntries(tripCatalogueQuery(c))))).map(tripCatalogueRow);
  else if (c.source === 'vehicles') rows = (await listPublicVehicles()).map(v => ({ id: String(v.id), title: v.name, href: `/vehicles/${v.id}`, image: v.imageUrl || VEHICLE_IMAGE_FALLBACK, description: v.features.join(' · '), price: v.pricePerDay, priceLabel: 'per day · final quote at checkout', seats: v.seatingCapacity, available: v.isAvailable, featured: false, category: v.typeSlug, categoryLabel: v.typeTitle, region: 0, regionLabel: '', pickup: 0, pickupLabel: '', date: '', rating: v.rating ?? 0 }));
  else rows = (await listPublicPackages()).map(p => ({ id: String(p.id), title: p.name, href: `/packages/${p.slug}`, image: p.imageUrl || PACKAGE_IMAGE_FALLBACK, description: p.highlights.join(' · '), price: p.pricePerPerson, priceLabel: 'per person · final quote at checkout', seats: p.maxPersons, available: true, featured: false, category: '', categoryLabel: '', region: p.regionId, regionLabel: p.regionName, pickup: 0, pickupLabel: '', date: '', rating: p.rating ?? 0 }));
  return filterCatalogue(rows, catalogueFilters(c));
}
export async function cmsOptions(): Promise<CmsOptions> {
  const [pages, categories, regions, cities, vehicles, packages, trips] = await Promise.all([
    getPool().query("SELECT slug,published_content->'seo'->>'title' AS title FROM cms_pages WHERE status='published' AND is_active AND NOT is_deleted ORDER BY title"),
    listPublicVehicleTypes(), getPool().query("SELECT region_id AS value,name AS label FROM regions WHERE is_active AND NOT is_deleted ORDER BY name"),
    getPool().query("SELECT city_id AS value,name AS label FROM cities WHERE is_active AND NOT is_deleted ORDER BY name"),
    listPublicVehicles(), listPublicPackages(), listPublicTrips(),
  ]);
  return { categories: categories.map(c => ({ value: c.slug, label: c.title })), regions: regions.rows, cities: cities.rows,
    destinations: [
      ...pages.rows.map(p => ({ href: cmsPath(p.slug), label: p.title || p.slug, kind: 'page' as const })),
      ...[{ href: '/vehicles', label: 'Browse vehicles' }, { href: '/packages', label: 'Travel packages' }, { href: '/weekend-trips', label: 'Weekend Trips' }, { href: '/booking', label: 'Plan a trip' }, { href: '/contact', label: 'Contact us' }].map(p => ({ ...p, kind: 'page' as const })),
      ...vehicles.map(v => ({ href: `/vehicles/${v.id}`, label: v.name, kind: 'vehicles' as const })),
      ...packages.map(p => ({ href: `/packages/${p.slug}`, label: p.name, kind: 'packages' as const })),
      ...trips.map(t => ({ href: `/weekend-trips/${t.slug}`, label: `${t.title} · ${t.startsAt.slice(0, 10)}`, kind: 'weekend-trips' as const })),
    ] };
}
/** Picker choices are resolved against real published records, never raw SQL/routes. */
export async function resolveCmsDestination(input: Record<string, unknown>) {
  const options = await cmsOptions();
  if (input.kind === 'destination') {
    const destination = options.destinations.find(d => d.href === input.href);
    if (!destination) throw new CmsError('That destination is no longer published. Choose another.');
    return destination.href;
  }
  if (input.kind !== 'filtered' || !['vehicles', 'packages', 'weekend-trips'].includes(String(input.source))) throw new CmsError('Choose a valid destination type.');
  const source = String(input.source), raw = input.filters;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CmsError('Check the listing filters.');
  const f = raw as Record<string, unknown>, p = new URLSearchParams();
  const keys = source === 'vehicles' ? ['category'] : source === 'packages' ? ['regionId'] : ['cityId', 'regionId', 'from', 'to', 'minPrice', 'maxPrice', 'seats', 'featured', 'sort'];
  if (Object.keys(f).some(k => !keys.includes(k))) throw new CmsError('This listing does not support that filter.');
  if (f.category && !options.categories.some(c => c.value === f.category)) throw new CmsError('Choose an active vehicle category.');
  if (f.regionId && !options.regions.some(r => r.value === Number(f.regionId))) throw new CmsError('Choose an active destination.');
  if (f.cityId && !options.cities.some(c => c.value === Number(f.cityId))) throw new CmsError('Choose an active pickup city.');
  const parsed = source === 'weekend-trips' ? readTripFilters(f) : f;
  for (const [key, value] of Object.entries(parsed)) if (value !== '' && value != null && value !== false) p.set(key, String(value));
  return `/${source}${p.size ? '?' + p.toString() : ''}`;
}
