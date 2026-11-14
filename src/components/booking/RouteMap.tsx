"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, useMap, useMapEvents } from "react-leaflet";
import type { RoutePoint, BookingRoute } from "@/lib/booking-route";
import "leaflet/dist/leaflet.css";

function Controls({pickup,drop,onPick}:{pickup:RoutePoint|null;drop:RoutePoint|null;onPick:(p:RoutePoint)=>void}) {
  const map=useMap(); useMapEvents({click:event=>onPick({lat:event.latlng.lat,lng:event.latlng.lng})});
  useEffect(()=>{ if(pickup&&drop) map.fitBounds([[pickup.lat,pickup.lng],[drop.lat,drop.lng]],{padding:[30,30],maxZoom:15});
    else if(pickup||drop){const p=(pickup||drop)!;map.setView([p.lat,p.lng],14);}
  },[pickup,drop,map]);
  return null;
}
export default function RouteMap({pickup,drop,route,onPick}:{pickup:RoutePoint|null;drop:RoutePoint|null;route:BookingRoute|null;onPick:(p:RoutePoint)=>void}) {
  return <div className="h-72 overflow-hidden rounded-xl border border-line">
    <MapContainer center={[28.6139,77.209]} zoom={10} className="h-full w-full" scrollWheelZoom={false}>
      <TileLayer url={process.env.NEXT_PUBLIC_BOOKING_TILE_URL??"https://tile.openstreetmap.org/{z}/{x}/{y}.png"} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      <Controls pickup={pickup} drop={drop} onPick={onPick}/>
      {pickup&&<CircleMarker center={[pickup.lat,pickup.lng]} radius={10} pathOptions={{color:"#15803d",fillOpacity:0.9}}/>}
      {drop&&<CircleMarker center={[drop.lat,drop.lng]} radius={10} pathOptions={{color:"#dc2626",fillOpacity:0.9}}/>}
      {route&&<Polyline positions={route.geometry.map(([lng,lat])=>[lat,lng])} pathOptions={{color:"#1d4ed8",weight:4}}/>}
    </MapContainer>
  </div>;
}
