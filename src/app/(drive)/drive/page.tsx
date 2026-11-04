"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
export interface Trip {id:string;reference:string;status:string;startsAt:string;pickup:string|null;drop:string|null;passengers:number}
export default function DriverTrips(){
  const [trips,setTrips]=useState<Trip[]|null>(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;async function load(){try{const r=await fetch('/api/driver/trips',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);if(alive){setTrips(d.trips);setError('');}}catch(e){if(alive)setError(e instanceof Error?e.message:'Unable to load trips.');}}void load();const t=setInterval(()=>void load(),15000);return()=>{alive=false;clearInterval(t);};},[]);
  return <><h1 className="mb-4 text-2xl font-bold">My trips</h1>{error&&<p role="alert">{error}</p>}{!trips&&!error&&<p>Loading…</p>}{trips?.length===0&&<p>No active trips assigned. Contact your dispatcher.</p>}
  {trips?.map(t=><Link key={t.id} href={`/drive/${t.id}`} className="mb-3 block rounded-xl border border-line bg-surface p-4"><strong>{t.reference}</strong><p>{t.status} · {new Date(t.startsAt).toLocaleString('en-IN')}</p><p>{t.pickup||'Pickup to be confirmed'} → {t.drop||'Drop to be confirmed'}</p></Link>)}</>;
}
