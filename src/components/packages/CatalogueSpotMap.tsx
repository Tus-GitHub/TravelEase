"use client";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { TouristSpot } from "@/types";

type Props = { spots: TouristSpot[]; selected: string[]; onToggle: (spot: TouristSpot) => void; maxSpots: number };
function Bounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => { if (points.length) map.fitBounds(points, { padding: [25, 25], maxZoom: 13 }); }, [map, points]);
  return null;
}
export default function CatalogueSpotMap({ spots, selected, onToggle, maxSpots }: Props) {
  const mapped = useMemo(() => spots.filter(spot => typeof spot.latitude === "number" && typeof spot.longitude === "number" && Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude)), [spots]);
  const points = useMemo(() => mapped.map(spot => [spot.latitude!, spot.longitude!] as [number, number]), [mapped]);
  return <div className="h-80 overflow-hidden rounded-2xl border border-line"><MapContainer center={points[0] ?? [22.97, 78.65]} zoom={5} className="h-full w-full"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/><Bounds points={points}/>{mapped.map(spot => { const chosen = selected.includes(spot.id), disabled = !chosen && selected.length >= maxSpots; return <CircleMarker key={spot.id} center={[spot.latitude!, spot.longitude!]} radius={chosen ? 13 : 10} pathOptions={{ color: disabled ? "#64748b" : chosen ? "#f59e0b" : "#1d4ed8", fillOpacity: 0.85, weight: 3 }} eventHandlers={{ click: () => { if (!disabled) onToggle(spot); } }}><Tooltip>{spot.name}{chosen ? " · Selected" : " · Click to add"}</Tooltip></CircleMarker>; })}</MapContainer></div>;
}
