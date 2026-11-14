"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Button from "@/components/common/Button";
import { routePoint, type RoutePoint, type BookingRoute } from "@/lib/booking-route";
const RouteMap=dynamic(()=>import("./RouteMap"),{ssr:false,loading:()=> <p className="text-sm text-muted">Loading map…</p>});
const field="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-fg";
type Place=RoutePoint&{label:string};

export default function TripRouteSelector({roundTrip,pickup,drop,onPickup,onDrop,onRoute}:{roundTrip:boolean;pickup:RoutePoint|null;drop:RoutePoint|null;onPickup:(p:RoutePoint|null,label?:string)=>void;onDrop:(p:RoutePoint|null,label?:string)=>void;onRoute:(route:BookingRoute|null)=>void}) {
  const [queries,setQueries]=useState({pickup:"",drop:""});
  const [results,setResults]=useState<{target:"pickup"|"drop";places:Place[]}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [mapOpen,setMapOpen]=useState(false),[target,setTarget]=useState<"pickup"|"drop">("pickup");
  const [route,setRoute]=useState<BookingRoute|null>(null);
  const active=useRef<AbortController|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const call=useCallback(async(body:object)=> {
    active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);setError("");
    try {
      const response=await fetch("/api/booking-map",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
      const data=await response.json();if(controller.signal.aborted)return null;
      if(!response.ok)throw new Error(data.error??"Map service unavailable.");return data;
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Map service unavailable.");return null;}
    finally{if(!controller.signal.aborted)setBusy(false);}
  },[]);
  async function search(which:"pickup"|"drop") {
    setResults(null);
    const data=await call({action:"search",query:queries[which]});
    if(data){setResults({target:which,places:data.results});if(!data.results.length)setError("No places found. Try a nearby landmark or choose a point on the map.");}
  }
  const calculate=useCallback(async()=> {
    if(timer.current)clearTimeout(timer.current);
    if(!pickup||!drop)return;
    setRoute(null);onRoute(null);
    const data=await call({action:"route",pickup,drop,roundTrip});
    if(data){setRoute(data.route);onRoute(data.route);}
  },[pickup,drop,roundTrip,onRoute,call]);
  useEffect(()=>{active.current?.abort();setBusy(false);setRoute(null);onRoute(null);setError("");
    if(pickup&&drop)timer.current=setTimeout(()=>void calculate(),400);
    return()=>{if(timer.current)clearTimeout(timer.current);active.current?.abort();};
  },[pickup,drop,onRoute,calculate]);
  function choose(which:"pickup"|"drop",point:RoutePoint,label?:string){const normalized=routePoint(point)!;(which==="pickup"?onPickup:onDrop)(normalized,label);setResults(null);}
  return <div className="space-y-4 rounded-2xl border border-line p-4">
    <h3 className="font-semibold text-fg">From where to where?</h3>
    <p className="text-xs text-muted">Search a public place or area, then choose the result. Keep names, phone numbers and private pickup instructions in the address fields below.</p>
    {(["pickup","drop"] as const).map(which=><div key={which}>
      <label className="mb-1 block text-sm font-medium text-fg" htmlFor={`route-${which}`}>{which==="pickup"?"Pickup location":"Destination location"}</label>
      <div className="flex flex-col gap-2 sm:flex-row"><input id={`route-${which}`} className={`${field} min-w-0 flex-1`} value={queries[which]} placeholder="Public place or area" maxLength={150}
        onChange={e=>{active.current?.abort();setBusy(false);setQueries(previous=>({...previous,[which]:e.target.value}));setResults(null);(which==="pickup"?onPickup:onDrop)(null);}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void search(which);}}}/>
        <Button type="button" variant="outline" size="sm" disabled={busy||queries[which].trim().length<3} onClick={()=>search(which)}>Search {which==="pickup"?"pickup":"destination"}</Button></div>
      {(which==="pickup"?pickup:drop)&&<p className="mt-1 text-xs text-green-700 dark:text-green-400">{which==="pickup"?"Pickup":"Destination"} selected: {(which==="pickup"?pickup:drop)!.lat.toFixed(5)}, {(which==="pickup"?pickup:drop)!.lng.toFixed(5)}</p>}
      {results?.target===which&&<ul className="mt-2 space-y-1">{results.places.map((place,i)=><li key={i}><button type="button" className="w-full rounded-lg border border-line px-3 py-3 text-left text-sm text-fg hover:bg-surface-hover" onClick={()=>choose(which,place,place.label)}>{place.label}</button></li>)}</ul>}
    </div>)}
    <Button type="button" variant="outline" size="sm" onClick={()=>setMapOpen(v=>!v)}>{mapOpen?"Hide map":"Choose on map (optional)"}</Button>
    {mapOpen&&<div className="space-y-3"><div role="group" aria-label="Point to choose on map" className="flex flex-wrap gap-2">{(["pickup","drop"] as const).map(which=><button key={which} type="button" aria-pressed={target===which} onClick={()=>setTarget(which)} className={`min-h-11 rounded-lg border px-3 text-sm ${target===which?"border-primary-700 bg-primary-700 text-white":"border-line text-fg"}`}>{which==="pickup"?"Set pickup (green)":"Set destination (red)"}</button>)}</div>
      <p className="text-xs text-muted">Tap the map to set {target==="pickup"?"pickup":"destination"}. Zoom in for an accurate location.</p>
      <RouteMap pickup={pickup} drop={drop} route={route} onPick={p=>choose(target,p)}/></div>}
    <Button type="button" variant="accent" fullWidth disabled={!pickup||!drop||busy} onClick={calculate}>{busy?"Checking map…":roundTrip?"Calculate round-trip distance":"Calculate road distance"}</Button>
    {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    {route&&<p role="status" className="text-sm font-semibold text-fg">{route.distanceKm.toLocaleString("en-IN")} km by road{roundTrip?" (outbound + return)":""} · approx. {Math.round(route.durationHours*60)} minutes driving</p>}
    <p className="text-xs leading-relaxed text-muted">Location searches and route points use OpenStreetMap services; no personal instructions are sent. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a> · Routes by <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer" className="underline">FOSSGIS</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer" className="underline">Report a map issue</a>. Free-service limits apply; availability is not guaranteed.</p>
  </div>;
}
