"use client";
import {useEffect} from 'react';
import {MapContainer,TileLayer,CircleMarker,useMap} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
function Follow({lat,lng}:{lat:number;lng:number}){const map=useMap();useEffect(()=>{map.setView([lat,lng]);},[map,lat,lng]);return null;}
export default function TrackingMap({lat,lng}:{lat:number;lng:number}){return <MapContainer center={[lat,lng]} zoom={15} className="h-64 w-full rounded-xl" aria-label="Driver location map"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><CircleMarker center={[lat,lng]} radius={10}/><Follow lat={lat} lng={lng}/></MapContainer>;}
