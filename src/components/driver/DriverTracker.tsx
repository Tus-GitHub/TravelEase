"use client";
import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
const Map=dynamic(()=>import('./TrackingMap'),{ssr:false});
interface Position{lat:number;lng:number;accuracy:number|null;recordedAt:string}
export default function DriverTracker({bookingId}:{bookingId:string}){
  const [position,setPosition]=useState<Position|null>(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;async function load(){try{const r=await fetch(`/api/bookings/${bookingId}/driver-location`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error('Tracking is unavailable.');if(alive){setPosition(d.location);setError('');}}catch{if(alive){setPosition(null);setError('Unable to refresh tracking. Retrying shortly.');}}}void load();const t=setInterval(()=>void load(),15000);return()=>{alive=false;clearInterval(t);};},[bookingId]);
  return <section className="my-4 space-y-2"><h2 className="font-bold">Driver location</h2>{error?<p role="status">{error}</p>:position?<><Map lat={position.lat} lng={position.lng}/><p className="text-sm text-muted">Updated {new Date(position.recordedAt).toLocaleTimeString()} {position.accuracy!=null?`· GPS accuracy about ${Math.round(position.accuracy)} m`:''}</p></>:<p className="text-sm text-muted">No recent location shared. Your driver may be offline or have stopped sharing.</p>}</section>;
}
