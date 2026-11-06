"use client";
import { useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Button from "@/components/common/Button";
import ActionDialog from "@/components/common/ActionDialog";
import { useAuth } from "@/context/AuthContext";
import type { PublicTrip } from "@/lib/weekend-public";
import type { PriceBreakdown } from "@/lib/server/pricing";
import { formatTripDate } from "@/lib/weekend-trips";
import { TripField,tripInput } from "./TripFields";
interface Traveller {name:string;age:string;phone:string}
interface SharedRequest {departureId:string;clientRequestId:string;passengerCount:number;passengers:{name:string;age:number|null;phone:string}[];customerNotes:string;quotedVersion:number}
export default function WeekendCheckout({departureId}:{departureId:string}) {
  const {user,isLoading}=useAuth(),router=useRouter();
  const [trip,setTrip]=useState<PublicTrip>(),[loading,setLoading]=useState(true),[error,setError]=useState(''),[travellers,setTravellers]=useState<Traveller[]>([{name:'',age:'',phone:''}]),[notes,setNotes]=useState(''),[quote,setQuote]=useState<{quote:PriceBreakdown;version:number}>(),[quoting,setQuoting]=useState(false),[refresh,setRefresh]=useState(0),[confirm,setConfirm]=useState(false),[uncertain,setUncertain]=useState(false);
  const pending=useRef<SharedRequest|null>(null),requestKey=useRef<string>();
  useEffect(()=>{const controller=new AbortController();fetch(`/api/weekend-trips/${encodeURIComponent(departureId)}`,{signal:controller.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Trip unavailable.');setTrip(d.item);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[departureId,refresh]);
  useEffect(()=>{if(user)setTravellers(rows=>rows.map((row,i)=>i===0?{...row,name:row.name||user.name,phone:row.phone||user.phone}:row));},[user]);
  useEffect(()=>{if(!trip||uncertain)return;const controller=new AbortController();setQuoting(true);setQuote(undefined);
    fetch('/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({departureId,passengerCount:travellers.length}),signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to calculate this trip.');setQuote(d);setError('');}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setQuoting(false);});return()=>controller.abort();
  },[trip,departureId,travellers.length,uncertain]);
  function count(value:number){if(!Number.isSafeInteger(value)||value<1||value>50)return;setTravellers(rows=>Array.from({length:value},(_,i)=>rows[i]??{name:'',age:'',phone:''}));}
  async function reserve() {
    if(!quote&&!pending.current)return {ok:false,error:'Refresh the price before booking.'};
    if(!pending.current){requestKey.current??=crypto.randomUUID();pending.current={departureId,clientRequestId:requestKey.current,passengerCount:travellers.length,passengers:travellers.map(p=>({name:p.name.trim(),age:p.age===''?null:Number(p.age),phone:p.phone.trim()})),customerNotes:notes,quotedVersion:quote!.version};}
    try {
      const r=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending.current)});
      const d=await r.json();
      if(!r.ok){
        if(r.status<500){pending.current=null;requestKey.current=undefined;setUncertain(false);setRefresh(n=>n+1);}else setUncertain(true);
        return {ok:false,error:d.error||'We could not confirm the result. Retry the same request or check My bookings.'};
      }
      if(!d.booking?.id)throw Error('Missing booking response');
      router.push(`/profile/bookings/${d.booking.id}`);return {ok:true};
    }catch{setUncertain(true);return {ok:false,error:'The result is not confirmed. Retry with these same details, or check My bookings before making another reservation.'};}
  }
  if(loading||isLoading)return <p className="py-12 text-center text-muted">Preparing your weekend…</p>;
  if(!trip)return <div role="alert" className="rounded-3xl border border-line p-8">{error||'Trip unavailable.'}<Button href="/weekend-trips" className="mt-5" variant="outline">Browse trips</Button></div>;
  if(!user)return <div className="mx-auto max-w-xl rounded-3xl border border-line bg-surface p-9 text-center"><h2 className="text-2xl font-bold">Save your place in the group</h2><p className="mt-4 text-muted">Sign in to add your travellers and reserve seats for {trip.title}.</p><Button href={`/login?redirect=${encodeURIComponent('/booking/new?departure='+departureId)}`} variant="accent" className="mt-7">Sign in to continue</Button></div>;
  return <><div className="mx-auto grid max-w-6xl gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]"><form className="rounded-3xl border border-line bg-surface p-6 sm:p-8" onSubmit={e=>{e.preventDefault();setConfirm(true);}}><p className="text-xs font-semibold uppercase tracking-widest text-accent-500">Your weekend crew</p><h2 className="mt-2 font-display text-2xl font-bold">Who’s joining the journey?</h2><p className="mt-3 text-sm leading-relaxed text-muted">Every traveller needs a seat. The same inclusive price applies to each person; please discuss child or accessibility needs with the team before paying.</p>
      <fieldset disabled={uncertain} className="mt-7 space-y-6"><TripField label="Number of travellers"><input type="number" min={1} max={Math.min(50,trip.capacity)} className={tripInput} value={travellers.length} onChange={e=>count(Number(e.target.value))}/></TripField>
        {travellers.map((p,i)=><div key={i} className="rounded-2xl border border-line bg-surface-muted/40 p-5"><h3 className="mb-4 font-semibold">Traveller {i+1}{i===0?' · Lead contact':''}</h3><div className="grid gap-4 sm:grid-cols-2"><TripField label={`Full name · traveller ${i+1}`}><input required maxLength={200} autoComplete={i===0?'name':'off'} className={tripInput} value={p.name} onChange={e=>setTravellers(rows=>rows.map((r,n)=>n===i?{...r,name:e.target.value}:r))}/></TripField><TripField label={`Age · traveller ${i+1}`}><input type="number" min={0} max={120} className={tripInput} value={p.age} onChange={e=>setTravellers(rows=>rows.map((r,n)=>n===i?{...r,age:e.target.value}:r))}/></TripField><TripField label={`Contact number · traveller ${i+1}`}><input required={i===0} type="tel" maxLength={30} autoComplete={i===0?'tel':'off'} className={tripInput} value={p.phone} onChange={e=>setTravellers(rows=>rows.map((r,n)=>n===i?{...r,phone:e.target.value}:r))}/></TripField></div></div>)}
        <TripField label="Notes for the team" help="Tell us about room-sharing preferences or support needs. Requests need the team’s confirmation."><textarea className={tripInput} rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></TripField>
        <label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" required className="mt-1 accent-accent-500"/>I have reviewed the itinerary, stated hotel sharing, inclusions and cancellation conditions. I understand this is a shared group trip.</label>
      </fieldset>
      {error&&<p role="alert" className="mt-5 rounded-xl bg-red-500/10 p-4 text-sm text-red-600">{error}</p>}{uncertain&&<p role="alert" className="mt-5 rounded-xl bg-amber-500/10 p-4 text-sm">Your request may have been saved. Retry the same details to recover it, or check your bookings.</p>}
      <div className="mt-7 flex flex-wrap gap-3 border-t border-line pt-6"><Button type="submit" variant="accent" disabled={!uncertain&&(!quote||quoting)}>{uncertain?'Retry this reservation':'Reserve my seats'}</Button><Button href={uncertain?'/profile/bookings':`/weekend-trips/${trip.slug}`} variant="outline">{uncertain?'My bookings':'Review the trip'}</Button></div>
    </form><aside className="space-y-5"><div className="overflow-hidden rounded-3xl border border-line bg-surface"><div className="relative h-44"><Image src={trip.content.imageUrl} alt={trip.content.imageAlt} fill sizes="(max-width:1024px) 100vw,350px" className="object-cover"/></div><div className="p-6"><h2 className="text-xl font-bold">{trip.title}</h2><p className="mt-3 text-sm text-muted">{formatTripDate(trip.startsAt)} IST<br/>Pickup: {trip.pickupAddress}</p><div className="mt-6 space-y-3 border-t border-line pt-5">{quote?.quote.breakdown.map(line=><div key={line.label} className="flex justify-between gap-4 text-sm text-muted"><span>{line.label}</span><span>₹{line.amount.toLocaleString('en-IN')}</span></div>)}<div className="flex justify-between pt-3 text-xl font-bold"><span>Total · {travellers.length}</span><span>{quoting?'…':quote?`₹${quote.quote.totalAmount.toLocaleString('en-IN')}`:'—'}</span></div></div><p className="mt-4 text-xs leading-relaxed text-muted">The listed group price includes taxes. Coupons do not apply to Weekend Trips.</p></div></div><div className="rounded-2xl bg-primary-950 p-6 text-white"><h3 className="font-semibold">A hold first. Payment next.</h3><p className="mt-3 text-sm leading-relaxed text-white/70">After reserving, contact the team for offline payment. Your exact deadline appears in My bookings. Holds last up to {trip.paymentHoldMinutes} minutes and can expire sooner at booking close.</p></div><p className="text-xs leading-relaxed text-muted">{trip.cancellationPolicy}</p></aside></div>
    {confirm&&<ActionDialog title="Reserve these seats?" description={`${travellers.length} traveller${travellers.length===1?'':'s'} for ${trip.title}. ${quote?`Total ₹${quote.quote.totalAmount.toLocaleString('en-IN')}. `:''}Your seats stay on hold only until the payment deadline. No online payment is collected here.`} confirmLabel={uncertain?'Recover my reservation':'Hold my seats'} onConfirm={reserve} onClose={()=>setConfirm(false)}/>}
  </>;
}
