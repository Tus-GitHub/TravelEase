"use client";
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Button from '@/components/common/Button';
import type {Trip} from '../page';
export default function DriverTrip(){
  const {id}=useParams<{id:string}>();
  return <TripScreen key={id} id={id}/>;
}
function TripScreen({id}:{id:string}){
  const [trip,setTrip]=useState<Trip|null>(null),[error,setError]=useState(''),[sharing,setSharing]=useState(false),[sent,setSent]=useState('');
  useEffect(()=>{let alive=true;async function load(){try{const r=await fetch(`/api/driver/trips/${id}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);if(alive){setTrip(d.trip);setError('');if(d.trip.status!=='Ongoing')setSharing(false);}}catch(e){if(alive){setTrip(null);setSharing(false);setError(e instanceof Error?e.message:'Unable to load trip.');}}}void load();const timer=setInterval(()=>void load(),15000);return()=>{alive=false;clearInterval(timer);};},[id]);
  useEffect(()=>{
    if(!sharing)return;
    if(!navigator.geolocation||!window.isSecureContext){setError('Location sharing needs HTTPS and browser location support.');setSharing(false);return;}
    let active=true,busy=false,last=0;const controller=new AbortController();
    const watch=navigator.geolocation.watchPosition(async p=>{
      if(!active||busy||Date.now()-last<15000)return;busy=true;last=Date.now();
      try{const r=await fetch(`/api/driver/trips/${id}/location`,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy})});
        const d=await r.json();if(!active)return;
        if(!r.ok){if([401,403,404].includes(r.status))setSharing(false);if(r.status!==429)throw new Error(d.error);}
        else{setSent(new Date().toLocaleTimeString());setError('');}
      }catch(e){if(active)setError(e instanceof Error?e.message:'Location could not be sent.');}finally{busy=false;}
    },e=>{if(active){setError(e.code===1?'Location permission denied. Enable it in your browser to share.':'Unable to obtain GPS. Check your device location settings.');if(e.code===1)setSharing(false);}},{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
    const hide=()=>{if(document.hidden)setSharing(false);};document.addEventListener('visibilitychange',hide);
    return()=>{active=false;controller.abort();navigator.geolocation.clearWatch(watch);document.removeEventListener('visibilitychange',hide);};
  },[sharing,id]);
  return <><h1 className="text-2xl font-bold">{trip?.reference||'Trip'}</h1>{error&&<p role="alert" className="my-3 text-red-600">{error}</p>}{trip&&<div className="my-4 space-y-3 rounded-xl border border-line bg-surface p-4"><p>{trip.status} · {new Date(trip.startsAt).toLocaleString('en-IN')}</p><p>Pickup: {trip.pickup||'Contact dispatcher'}</p><p>Drop: {trip.drop||'Contact dispatcher'}</p><p>{trip.passengers} passengers</p>
    <p className="text-sm text-muted">Share GPS with this trip’s customer only while the trip is ongoing. Keep this screen open. Sharing stops when you leave or hide this page; the last position expires after 10 minutes.</p>
    <Button disabled={trip.status!=='Ongoing'} onClick={()=>{setError('');setSharing(!sharing);}}>{sharing?'Stop sharing':'Share my location'}</Button>
    <p aria-live="polite">{sharing?'Sharing enabled':'Sharing off'}{sent?` · Last sent ${sent}`:''}</p>
    {trip.status!=='Ongoing'&&<p>Your dispatcher must start the trip before you can share location.</p>}</div>}</>;
}
