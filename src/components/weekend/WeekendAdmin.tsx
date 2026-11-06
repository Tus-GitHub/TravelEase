"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import EditButton from "@/components/admin/EditButton";
import Button from "@/components/common/Button";
import Card from "@/components/common/Card";
import { type AdminDeparture, type DepartureInput, formatTripDate } from "@/lib/weekend-trips";
import type { TripOptions } from "@/lib/server/weekend-trips";
import DepartureEditor, { blankDeparture } from "./DepartureEditor";
import { tripApi, tripInput } from "./TripFields";
import TripOperations from "./TripOperations";
type Summary = { id: string; title: string; startsAt: string; endsAt: string; status: string; capacity: number; pricePerPerson: number | string; version: number; pickupCity: string; imageUrl: string; reservedSeats: number };
export default function WeekendAdmin() {
  const [operations,setOperations]=useState<string>();
  const [items, setItems] = useState<Summary[]>([]), [options, setOptions] = useState<TripOptions>(), [editor, setEditor] = useState<{ value: DepartureInput; id?: string; version?: number }>(), [loading, setLoading] = useState(true), [error, setError] = useState(""), [search, setSearch] = useState("");
  async function reload() { try { const data = await tripApi<{ items: Summary[]; options: TripOptions }>("/api/admin/weekend-trips"); setItems(data.items); setOptions(data.options); } catch (error) { setError((error as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void reload(); }, []);
  async function edit(id: string, copy = false) {
    setError("");
    try { const { item } = await tripApi<{ item: AdminDeparture }>(`/api/admin/weekend-trips/${id}`);
      if (!copy) { setEditor({ value: item, id, version: item.version }); return; }
      const shift = (value: string) => new Date(Date.parse(value) + 7 * 86400000).toISOString();
      const startsAt = shift(item.startsAt), slug = item.slug.replace(/-\d{4}-\d\d-\d\d$/, "").slice(0, 140) + '-' + startsAt.slice(0, 10);
      setEditor({ value: { ...item, slug, startsAt, endsAt: shift(item.endsAt), bookingOpensAt: new Date().toISOString(), bookingClosesAt: shift(item.bookingClosesAt), decisionDeadline: shift(item.decisionDeadline), content: { ...item.content, stayNights: item.content.stayNights.map(date => shift(date).slice(0, 10)) }, stays: item.stays.map(stay => ({ ...stay, id: undefined, checkIn: shift(stay.checkIn).slice(0, 10), checkOut: shift(stay.checkOut).slice(0, 10), confirmationStatus: "pending", supplierReference: "", supplierCost: null })) } });
    } catch (error) { setError((error as Error).message); }
  }
  const shown = items.filter(item => `${item.title} ${item.pickupCity} ${item.status}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-7">
    <AdminPageHeader className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-accent-500">Friday, together</p><h1 className="mt-2 font-display text-3xl font-bold">Weekend Trips</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">Create a shared journey. Plan the route, meet the team, arrange the stay and bring your travellers together.</p></div><div className="flex flex-wrap gap-3"><Button href="/admin/tour-guides" variant="outline" iconLeft="users">Guides</Button><Button variant="accent" iconLeft="calendar" disabled={!options?.packages.length || !options.cities.length} onClick={() => { if (options) setEditor({ value: blankDeparture(options) }); }}>Create weekend trip</Button></div></AdminPageHeader>
    <div className="grid gap-4 sm:grid-cols-3">{[["Departures",items.length],["Open for booking",items.filter(item => ['open','guaranteed'].includes(item.status)).length],["Seats committed",items.filter(item => !['cancelled','completed'].includes(item.status)).reduce((sum,item)=>sum+item.reservedSeats,0)]].map(([label,value]) => <Card key={String(label)} padded hover={false}><p className="text-xs uppercase tracking-wider text-muted">{label}</p><p className="mt-3 font-display text-3xl font-bold">{value}</p></Card>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-4"><label className="w-full max-w-sm text-sm font-semibold">Find a departure<input className={tripInput} placeholder="Search trips, pickup cities or status" value={search} onChange={e => setSearch(e.target.value)} /></label><p className="text-xs text-muted">Times shown in India time · IST</p></div>
    {error && <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-600">{error}</p>}
    {options && !options.packages.length && <Card padded hover={false}><h2 className="font-bold">Start with an itinerary template</h2><p className="mt-2 text-sm text-muted">Create a package with its destination and route, then schedule Friday departures from it.</p><Button href="/admin/packages" className="mt-4" size="sm" variant="outline">Manage packages</Button></Card>}
    {loading ? <p className="text-muted">Loading departures…</p> : shown.length ? <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">{shown.map(item => <Card key={item.id} hover={false} className="overflow-hidden">
      <div className="relative h-40 bg-gradient-to-br from-primary-900 to-primary-700">{item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="(max-width:1024px) 100vw,33vw" className="object-cover" />}<div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /><span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold capitalize text-primary-900">{item.status}</span><p className="absolute bottom-4 left-4 right-4 text-xs font-semibold text-white">{formatTripDate(item.startsAt)}</p></div>
      <div className="p-5"><h2 className="font-display text-xl font-bold">{item.title}</h2><p className="mt-2 text-sm text-muted">From {item.pickupCity}</p><div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-xl font-bold">₹{Number(item.pricePerPerson).toLocaleString('en-IN')}</p><p className="mt-1 text-xs text-muted">inclusive / person</p></div><p className="text-sm text-muted">{item.reservedSeats} / {item.capacity} seats</p></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><Button type="button" size="sm" variant="accent" onClick={() => setOperations(item.id)}>Manage trip</Button><Button type="button" size="sm" variant="ghost" onClick={() => void edit(item.id, true)}>Copy to next Friday</Button>{item.status === 'draft' && <EditButton name={item.title} onClick={() => void edit(item.id)} />}</div></div>
    </Card>)}</div> : options?.packages.length ? <Card padded hover={false}><h2 className="font-bold">Your next Friday starts here</h2><p className="mt-2 text-sm text-muted">Create a draft, arrange the team and stay, then review the complete trip before taking bookings.</p></Card> : null}
    {editor && options && <DepartureEditor initial={editor.value} options={options} onClose={() => setEditor(undefined)} onSave={async draft => { await tripApi(`/api/admin/weekend-trips${editor.id ? '/' + editor.id : ''}`, editor.id ? 'PATCH' : 'POST', { ...draft, version: editor.version }); setEditor(undefined); await reload(); }} />}
    {operations&&<TripOperations id={operations} onClose={()=>setOperations(undefined)} onChanged={reload}/>}
  </div>;
}
