"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Button from "@/components/common/Button";
import PlaceAutocomplete from "./PlaceAutocomplete";
import { routePoint, type RoutePoint, type BookingRoute } from "@/lib/booking-route";
const RouteMap=dynamic(()=>import("./RouteMap"),{ssr:false,loading:()=> <p className="text-sm text-muted">Loading map…</p>});

export default function TripRouteSelector({roundTrip,pickup,drop,pickupLabel,dropLabel,onPickup,onDrop,onRoute}:{roundTrip:boolean;pickup:RoutePoint|null;drop:RoutePoint|null;pickupLabel?:string;dropLabel?:string;onPickup:(p:RoutePoint|null,label?:string)=>void;onDrop:(p:RoutePoint|null,label?:string)=>void;onRoute:(route:BookingRoute|null)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [mapOpen,setMapOpen]=useState(false),[target,setTarget]=useState<"pickup"|"drop">("pickup");
  const [route,setRoute]=useState<BookingRoute|null>(null);
  const active=useRef<AbortController|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const call=useCallback(async(body:object)=> {
    active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);setError("");
    try {
      for(let attempt=0;attempt<2;attempt++){
        if(controller.signal.aborted)return null;
        const response=await fetch("/api/booking-map",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
        const data=await response.json();if(controller.signal.aborted)return null;
        const after=Number(response.headers.get("Retry-After"));
        if(response.status===429&&attempt===0&&after>0&&after<=3){await new Promise(resolve=>setTimeout(resolve,after*1000));continue;}
        if(!response.ok)throw new Error(data.error??"Map service unavailable.");return data;
      }
      return null;
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Map service unavailable.");return null;}
    finally{if(!controller.signal.aborted)setBusy(false);}
  },[]);
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
  function choose(which:"pickup"|"drop",point:RoutePoint|null,label?:string){const normalized=routePoint(point);(which==="pickup"?onPickup:onDrop)(normalized,label);}
  return <div className="space-y-4 rounded-2xl border border-line p-4">
    <h3 className="font-semibold text-fg">From where to where?</h3>
    <p className="text-xs text-muted">Choose a suggestion as you type. Distance and fare update automatically.</p>
    <PlaceAutocomplete id="route-pickup" label="Pickup location" point={pickup} value={pickupLabel} onChoose={(p,label)=>choose("pickup",p,label)}/>
    <PlaceAutocomplete id="route-drop" label="Destination location" point={drop} value={dropLabel} onChoose={(p,label)=>choose("drop",p,label)}/>
    <Button type="button" variant="outline" size="sm" onClick={()=>setMapOpen(v=>!v)}>{mapOpen?"Hide map":"Choose on map (optional)"}</Button>
    {mapOpen&&<div className="space-y-3"><div role="group" aria-label="Point to choose on map" className="flex flex-wrap gap-2">{(["pickup","drop"] as const).map(which=><button data-ui-action="" key={which} type="button" aria-pressed={target===which} onClick={()=>setTarget(which)} className={`min-h-11 rounded-lg border px-3 text-sm ${target===which?"border-primary-700 bg-primary-700 text-white":"border-line text-fg"}`}>{which==="pickup"?"Set pickup (green)":"Set destination (red)"}</button>)}</div>
      <p className="text-xs text-muted">Tap the map to set {target==="pickup"?"pickup":"destination"}. Zoom in for an accurate location.</p>
      <RouteMap pickup={pickup} drop={drop} route={route} onPick={p=>choose(target,p)}/></div>}
    {busy&&<p role="status" className="text-sm text-muted">Calculating road distance and fare…</p>}
    {error&&<div role="alert" className="space-y-2 text-sm text-red-600 dark:text-red-300"><p>{error}</p><Button type="button" variant="outline" size="sm" disabled={!pickup||!drop||busy} onClick={calculate}>Retry distance</Button></div>}
    {route&&<p role="status" className="text-sm font-semibold text-fg">{route.distanceKm.toLocaleString("en-IN")} km by road{roundTrip?" (outbound + return)":""} · approx. {Math.round(route.durationHours*60)} minutes driving</p>}
    <p className="text-xs leading-relaxed text-muted">Places: <a href="https://photon.komoot.io" target="_blank" rel="noreferrer" className="underline">Photon</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a> · Routes: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer" className="underline">FOSSGIS</a>. Searches and route points go to these services. Keep personal details in the optional pickup instructions. Free-service limits apply.</p>
  </div>;
}
