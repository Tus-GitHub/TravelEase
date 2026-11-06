import Image from "next/image";
import Button from "@/components/common/Button";
import type { PublicTrip } from "@/lib/weekend-public";
import { formatTripDate } from "@/lib/weekend-trips";
export default function TripCard({trip,layout="grid"}:{trip:PublicTrip;layout?:"grid"|"list"}) {
  return <article className={`overflow-hidden rounded-3xl border border-line bg-surface shadow-sm ${layout==='list'?'sm:grid sm:grid-cols-[16rem_1fr]':''}`}>
    <div className="relative min-h-56 bg-primary-950"><Image src={trip.content.imageUrl} alt={trip.content.imageAlt||trip.title} fill sizes="(max-width:768px) 100vw,33vw" className="object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent"/><span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-primary-900">{trip.status==='guaranteed'?'Guaranteed departure':trip.status==='closed'?'Bookings closed':'Forming a group'}</span><p className="absolute bottom-4 left-5 right-5 text-sm font-semibold text-white">{formatTripDate(trip.startsAt)} IST</p></div>
    <div className="flex flex-col p-6"><p className="text-xs font-semibold uppercase tracking-widest text-accent-500">{trip.region} · Friday, together</p><h2 className="mt-2 font-display text-2xl font-bold">{trip.title}</h2><p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{trip.content.summary}</p><p className="mt-4 text-sm text-muted">Pickup: {trip.pickupCity} · {trip.availableSeats} seats left</p><div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5"><div><p className="text-2xl font-bold">₹{trip.pricePerPerson.toLocaleString('en-IN')}</p><p className="mt-1 text-xs text-muted">per traveller · all stated inclusions</p></div><Button href={`/weekend-trips/${trip.slug}`} variant="accent" size="sm" iconRight="arrow-right">View trip</Button></div></div>
  </article>;
}
