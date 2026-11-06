"use client";
import { useState } from 'react';
import AdminDialog from '@/components/admin/AdminDialog';
import Button from '@/components/common/Button';
import { cmsSafeLink } from '@/lib/cms';
import { sourceLabels, type CatalogueSource } from '@/lib/cms-catalogue';
import { useCmsControls } from './CmsControlsContext';
const input = 'mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-fg outline-none focus:border-accent-500';
export default function CmsLinkField({ id, label, value, disabled, onChange }: { id: string; label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const controls = useCmsControls();
  const [open, setOpen] = useState(false), [mode, setMode] = useState('page'), [selected, setSelected] = useState(''), [source, setSource] = useState<CatalogueSource>('weekend-trips');
  const [filters, setFilters] = useState<Record<string, string>>({}), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const options = controls.options;
  const choices = mode === 'anchor' ? controls.anchors : options?.destinations.filter(d => d.kind === mode) ?? [];
  const field = (key: string, v: string) => setFilters(f => ({ ...f, [key]: v }));
  async function apply() {
    setError('');
    if (mode === 'external' && (!selected.startsWith('https://') || !cmsSafeLink(selected))) { setError('Enter a valid HTTPS address.'); return; }
    if (mode !== 'filtered' && !selected) { setError('Choose a destination first.'); return; }
    setBusy(true);
    try {
      let href = selected;
      if (!['anchor', 'external'].includes(mode)) {
        const response = await fetch('/api/admin/cms/options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'filtered' ? { kind: 'filtered', source, filters } : { kind: 'destination', href: selected }) });
        const data = await response.json(); if (!response.ok) throw Error(data.error || 'Unable to check this link.'); href = data.href;
      }
      onChange(href); setOpen(false);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div><label htmlFor={id} className="text-sm font-semibold">{label}</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id={id} value={value} maxLength={1000} disabled={disabled} className={input + ' !mt-0 min-w-0 flex-1'} placeholder="/contact or https://…" onChange={e => onChange(e.target.value)} /><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => { setOpen(true); setError(''); setSelected(''); }}>Choose destination</Button></div><p className="mt-2 text-xs text-muted">Choose a real destination, or enter a supported site path or HTTPS link.</p>
    {open && <AdminDialog title="Choose link destination" description="Choose where this button or card takes your visitor." busy={busy} onClose={() => setOpen(false)}><div className="space-y-5 p-6 sm:p-8"><fieldset disabled={busy} className="space-y-5">
      <label className="block text-sm font-semibold">Link type<select aria-label="Link type" className={input} value={mode} onChange={e => { setMode(e.target.value); setSelected(''); setError(''); }}><option value="page">Site page</option><option value="vehicles">Specific vehicle</option><option value="packages">Specific package</option><option value="weekend-trips">Specific Weekend Trip</option><option value="filtered">Filtered listing</option><option value="anchor">Section on this page</option><option value="external">External HTTPS website</option></select></label>
      {!['anchor', 'external'].includes(mode) && !options && <p role="status" className="text-sm text-muted">{controls.error || 'Loading published destinations…'} {controls.error && <button type="button" className="font-semibold underline" onClick={controls.reload}>Retry</button>}</p>}
      {mode === 'external' ? <label className="block text-sm font-semibold">Website address<input aria-label="Website address" className={input} value={selected} maxLength={1000} onChange={e => setSelected(e.target.value)} placeholder="https://example.com" /></label> : mode !== 'filtered' ? <label className="block text-sm font-semibold">Destination<select aria-label="Destination" className={input} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose a destination</option>{choices.map((d, i) => <option key={d.href + i} value={d.href}>{d.label}</option>)}</select></label> : <>
        <label className="block text-sm font-semibold">Listing<select aria-label="Listing" className={input} value={source} onChange={e => { setSource(e.target.value as CatalogueSource); setFilters({}); }}>{Object.entries(sourceLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
        {source === 'vehicles' ? <label className="block text-sm font-semibold">Category<select aria-label="Category" className={input} value={filters.category || ''} onChange={e => field('category', e.target.value)}><option value="">All categories</option>{options?.categories.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label> : <label className="block text-sm font-semibold">Destination region<select aria-label="Destination region" className={input} value={filters.regionId || ''} onChange={e => field('regionId', e.target.value)}><option value="">All destinations</option>{options?.regions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}
        {source === 'weekend-trips' && <><label className="block text-sm font-semibold">Pickup city<select aria-label="Pickup city" className={input} value={filters.cityId || ''} onChange={e => field('cityId', e.target.value)}><option value="">All pickup cities</option>{options?.cities.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2">{[['from', 'Departure from', 'date'], ['to', 'Departure until', 'date'], ['maxPrice', 'Maximum price (₹)', 'number'], ['seats', 'Seats needed', 'number']].map(([key, text, type]) => <label key={key} className="block text-sm font-semibold">{text}<input aria-label={text} className={input} type={type} min={type === 'number' ? 1 : undefined} value={filters[key] || ''} onChange={e => field(key, e.target.value)} /></label>)}</div></>}
      </>}
      {selected && mode !== 'filtered' && <p className="break-all rounded-xl bg-surface-muted p-3 text-xs text-muted">{selected}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="accent" onClick={() => void apply()} disabled={busy || (!options && !['external', 'anchor'].includes(mode))}>{busy ? 'Checking…' : 'Use this link'}</Button></div>
    </fieldset></div></AdminDialog>}
  </div>;
}
