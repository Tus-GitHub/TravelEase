import type { Metadata } from "next";
import Button from "@/components/common/Button";
import TripCard from "@/components/weekend/TripCard";
import { listPublicTrips,readTripFilters } from "@/lib/server/weekend-public";
import { TripError } from "@/lib/weekend-trips";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Weekend Trips — Jagdamba Travellers",description:"Meet new people on a Friday group trip. Explore the itinerary, guide, transport and hotel inclusions, then reserve your seats."};
const field="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg";
export default async function Page({searchParams}:{searchParams:Record<string,string|undefined>}) {
  let error='';let filters={};
  try{filters=readTripFilters(searchParams);}catch(e){if(e instanceof TripError)error=e.message;else throw e;}
  const [all,items]=await Promise.all([listPublicTrips(),error?Promise.resolve([]):listPublicTrips(filters)]);
  const cities=Array.from(new Map(all.map(t=>[t.pickupCityId,t.pickupCity])).entries()),regions=Array.from(new Map(all.map(t=>[t.regionId,t.region])).entries());
  return <main className="pb-20 pt-20"><section className="bg-primary-950 px-5 py-16 text-white sm:py-24"><div className="mx-auto max-w-7xl"><p className="text-xs font-semibold uppercase tracking-[.25em] text-accent-400">Friday, together</p><h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">New places.<br/>New people.<br/><span className="text-accent-400">One memorable weekend.</span></h1><p className="mt-6 max-w-xl text-base leading-relaxed text-white/70">Join a group, meet your guide and leave the planning to us. Your transport, stated stay and itinerary come together in one inclusive price.</p></div></section>
    <div className="mx-auto max-w-7xl px-5"><form method="get" className="relative -mt-8 grid gap-4 rounded-3xl border border-line bg-surface p-5 shadow-xl sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-semibold">Pickup city<select name="cityId" defaultValue={searchParams.cityId??''} className={field}><option value="">All pickup cities</option>{cities.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-sm font-semibold">Destination<select name="regionId" defaultValue={searchParams.regionId??''} className={field}><option value="">All destinations</option>{regions.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-sm font-semibold">Depart on or after<input name="from" type="date" defaultValue={searchParams.from} className={field}/></label>
      <label className="text-sm font-semibold">Depart by<input name="to" type="date" defaultValue={searchParams.to} className={field}/></label>
      <label className="text-sm font-semibold">Budget per traveller · ₹<input name="maxPrice" type="number" min="0" step=".01" placeholder="Any budget" defaultValue={searchParams.maxPrice} className={field}/></label>
      <label className="text-sm font-semibold">Seats needed<input name="seats" type="number" min="1" max="50" defaultValue={searchParams.seats??1} className={field}/></label>
      <label className="text-sm font-semibold">Sort by<select name="sort" defaultValue={searchParams.sort??'date'} className={field}><option value="date">Next departure</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
      <div className="flex items-end gap-3"><Button type="submit" variant="accent">Find my weekend</Button><Button href="/weekend-trips" variant="ghost" size="sm">Reset</Button></div>
    </form>{error&&<p role="alert" className="mt-6 rounded-xl bg-red-500/10 p-4 text-red-600">{error}</p>}
    <div className="mb-7 mt-14 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-accent-500">Your next escape</p><h2 className="mt-2 font-display text-3xl font-bold">Upcoming Friday departures</h2></div><p className="text-sm text-muted">India time (IST) · {items.length} matching trips</p></div>
    {items.length?<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{items.map(trip=><TripCard key={trip.id} trip={trip}/>)}</div>:<div className="rounded-3xl border border-line bg-surface p-10 text-center"><h3 className="text-xl font-bold">A new weekend is on its way</h3><p className="mt-3 text-muted">No departures match these choices yet. Try another date or contact our team.</p><Button className="mt-6" href="/contact" variant="outline">Talk to us</Button></div>}
    <p className="mt-8 text-sm leading-relaxed text-muted">Seats are checked again when you book. A payment hold is temporary. Trips forming a group need the stated minimum number of paid travellers; if we cancel, paid bookings receive a full refund.</p></div></main>;
}
