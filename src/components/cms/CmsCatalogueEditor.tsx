"use client";
import { cmsDefinition, type CmsContent } from '@/lib/cms';
import CmsFields from './CmsFields';
const groups = [
  { title: 'Content & layout', help: 'Cards always open the selected vehicle, package or dated trip.', keys: ['eyebrow', 'title', 'subtitle', 'source', 'layout'] },
  { title: 'Your selection rules', help: 'Choose the records this section may show. Zero means no price or capacity limit. Vehicle availability here is its catalogue setting; date availability is checked at checkout.', keys: ['category', 'region', 'pickup', 'from', 'to', 'minPrice', 'maxPrice', 'minSeats', 'availableOnly', 'featuredOnly'] },
  { title: 'Filters your visitors see', help: 'Visitors can narrow your selection. Only controls relevant to the content source are available.', keys: ['showSearch', 'showCategory', 'showRegion', 'showPickup', 'showDates', 'showBudget', 'showSeats', 'showSort'] },
  { title: 'Order, count & empty results', help: 'Weekend Trips show upcoming departures. Availability refreshes every 30 seconds and is rechecked when seats are reserved.', keys: ['sort', 'count', 'empty', 'emptyMessage'] },
  { title: 'Section button', help: 'Use the destination picker to choose a page or supported filtered listing.', keys: ['buttonLabel', 'buttonHref'] },
];
export default function CmsCatalogueEditor(props: { value: CmsContent; onChange: (value: CmsContent) => void; prefix: string; disabled: boolean; onUpload: (target: string, file: File) => Promise<void> }) {
  return <div className="space-y-8">{groups.map(group => <section key={group.title} className="rounded-2xl border border-line p-4 sm:p-5"><h3 className="font-display text-lg font-bold">{group.title}</h3><p className="mb-5 mt-2 text-xs leading-relaxed text-muted">{group.help}</p><CmsFields {...props} fields={cmsDefinition('catalogue').fields.filter(f => group.keys.includes(f.key))} /></section>)}</div>;
}
