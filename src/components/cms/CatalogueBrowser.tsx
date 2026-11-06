"use client";
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Button from '@/components/common/Button';
import Section from '@/components/common/Section';
import { cmsHeading, cmsText, type CmsSection } from '@/lib/cms';
import { catalogueFilters, filterCatalogue, sortCatalogue, tripCatalogueQuery, tripCatalogueRow, type CatalogueRow, type CatalogueFilters } from '@/lib/cms-catalogue';
import type { PublicTrip } from '@/lib/weekend-public';
const input = 'mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-normal text-fg focus:outline-none focus:ring-2 focus:ring-accent-500/30';
export default function CatalogueBrowser({ section, initialRows }: { section: CmsSection; initialRows: CatalogueRow[] }) {
  const c = section.content;
  const [rows, setRows] = useState(initialRows), [filters, setFilters] = useState<CatalogueFilters>({}), [sort, setSort] = useState(String(c.sort)), [warning, setWarning] = useState('');
  const set = (key: keyof CatalogueFilters, value: string | number) => setFilters(f => ({ ...f, [key]: value }));
  useEffect(() => {
    if (c.source !== 'weekend-trips') return;
    const controller = new AbortController(); let active = false;
    const refresh = async () => {
      if (active || document.hidden) return;
      active = true;
      try {
        const response = await fetch('/api/weekend-trips?' + tripCatalogueQuery(c), { cache: 'no-store', signal: controller.signal });
        const data = await response.json(); if (!response.ok || !Array.isArray(data.items)) throw Error('Refresh failed');
        if (!controller.signal.aborted) { setRows(filterCatalogue((data.items as PublicTrip[]).map(tripCatalogueRow), catalogueFilters(c))); setWarning(''); }
      } catch { if (!controller.signal.aborted) setWarning('Availability could not refresh. Open a trip to check the latest seats.'); }
      finally { active = false; }
    };
    const timer = setInterval(() => void refresh(), 30000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [c]);
  const results = sortCatalogue(filterCatalogue(rows, filters), sort, String(c.source));
  const choices = (key: 'category' | 'region' | 'pickup', label: 'categoryLabel' | 'regionLabel' | 'pickupLabel') => Array.from(new Map(rows.filter(r => r[key]).map(r => [String(r[key]), r[label]])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const visibleFilters = ['showSearch', 'showCategory', 'showRegion', 'showPickup', 'showDates', 'showBudget', 'showSeats', 'showSort'].some(key => c[key]);
  if (!rows.length && c.empty === 'hide' && !warning) return <div id={`section-${section.id}`} />;
  return <Section {...cmsHeading(section)}><div data-cms-catalogue={section.id}>
    {visibleFilters && <form onSubmit={e => e.preventDefault()} aria-label={`${cmsText(section, 'title')} filters`} className="mb-8 rounded-2xl border border-line bg-surface p-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {c.showSearch === true && <label className="text-xs font-semibold">Search<input aria-label="Search catalogue" type="search" maxLength={120} className={input} value={filters.search || ''} onChange={e => set('search', e.target.value)} /></label>}
      {([['showCategory', 'category', 'categoryLabel', 'Category'], ['showRegion', 'region', 'regionLabel', 'Destination'], ['showPickup', 'pickup', 'pickupLabel', 'Pickup']] as const).map(([show, key, label, title]) => c[show] === true && <label key={key} className="text-xs font-semibold">{title}<select aria-label={title} className={input} value={filters[key] || ''} onChange={e => set(key, key === 'category' ? e.target.value : Number(e.target.value))}><option value="">All</option>{choices(key, label).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}
      {c.showDates === true && (['from', 'to'] as const).map(key => <label key={key} className="text-xs font-semibold">{key === 'from' ? 'Departure from' : 'Departure until'}<input aria-label={key === 'from' ? 'Departure from' : 'Departure until'} type="date" className={input} value={filters[key] || ''} min={String(c.from) || undefined} max={String(c.to) || undefined} onChange={e => set(key, e.target.value)} /></label>)}
      {c.showBudget === true && <label className="text-xs font-semibold">Maximum price (₹)<input aria-label="Maximum price (₹)" type="number" min={1} max={99999999} className={input} placeholder="Any price" value={filters.maxPrice || ''} onChange={e => set('maxPrice', Math.max(0, Number(e.target.value)))} /></label>}
      {c.showSeats === true && <label className="text-xs font-semibold">{c.source === 'weekend-trips' ? 'Seats needed' : 'Group size'}<input aria-label="Group size" type="number" min={1} max={100} className={input} placeholder="Any size" value={filters.minSeats || ''} onChange={e => set('minSeats', Math.max(0, Number(e.target.value)))} /></label>}
      {c.showSort === true && <label className="text-xs font-semibold">Order<select aria-label="Catalogue order" className={input} value={sort} onChange={e => setSort(e.target.value)}><option value="recommended">{c.source === 'weekend-trips' ? 'Next departure first' : 'Recommended'}</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></label>}
    </div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-muted" aria-live="polite">{results.length} matching {results.length === 1 ? 'journey' : 'journeys'} · showing up to {Number(c.count)}</p><Button type="button" size="sm" variant="ghost" onClick={() => { setFilters({}); setSort(String(c.sort)); }}>Reset filters</Button></div></form>}
    {warning && <p role="status" className="mb-4 rounded-xl bg-amber-500/10 p-3 text-sm">{warning}</p>}
    {results.length ? <div className={c.layout === 'list' ? 'space-y-5' : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'}>{results.slice(0, Number(c.count)).map(row => <article key={row.id} className={`overflow-hidden rounded-3xl border border-line bg-surface text-fg shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${c.layout === 'list' ? 'sm:grid sm:grid-cols-[16rem_minmax(0,1fr)]' : ''}`}>
      <Link href={row.href} tabIndex={-1} aria-hidden="true" className="relative block min-h-48 overflow-hidden bg-surface-muted"><Image src={row.image} alt="" fill sizes={c.layout === 'list' ? '256px' : '(max-width:640px) 100vw,33vw'} className="object-cover" /></Link><div className="flex flex-col p-6"><p className="text-xs font-semibold uppercase tracking-wider text-accent-600">{row.date ? `${row.date} · From ${row.pickupLabel}` : row.categoryLabel || row.regionLabel}</p><h3 className="mt-3 font-display text-xl font-bold"><Link href={row.href}>{row.title}</Link></h3><p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{row.description}</p><div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5"><div><p className="text-2xl font-bold">₹{row.price.toLocaleString('en-IN')}</p><p className="mt-1 text-xs text-muted">{row.priceLabel}</p><p className="mt-2 text-xs font-semibold text-muted">{c.source === 'weekend-trips' ? row.available ? `${row.seats} seats available` : 'Booking currently closed' : `Up to ${row.seats} travellers`}</p></div><Button href={row.href} size="sm" variant="outline">View details</Button></div></div>
    </article>)}</div> : <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">{rows.length ? 'No matches. Try changing or resetting your filters.' : String(c.emptyMessage)}</p>}
    {c.buttonLabel && c.buttonHref ? <div className="mt-9 text-center"><Button href={String(c.buttonHref)} variant="accent" iconRight="arrow-right">{String(c.buttonLabel)}</Button></div> : null}
  </div></Section>;
}
