"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Button from "@/components/common/Button";
import LocationSearchInput, { locationPoint, type LocationSuggestion } from "./LocationSearchInput";


export interface LatLng {
  lat: number;
  lng: number;
}

export interface ResolvedPlace {
  name?: string;
  label: string;
  city: string;
  state: string;
  pincode: string;
}

interface LocationPickerProps {
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
  /** Fired when a place is resolved (search pick or reverse geocode) so the parent can fill address fields. */
  onResolve?: (place: ResolvedPlace) => void;
}

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];
const DEFAULT_ZOOM = 4;
const PIN_ZOOM = 15;

// Inline SVG marker — avoids the classic Leaflet-with-bundlers broken-icon issue.
const pinIcon = L.divIcon({
  className: "",
  html: `<svg viewBox="0 0 24 36" width="30" height="45" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 24 12 24s12-15.6 12-24C24 5.37 18.63 0 12 0z" fill="#1e3a8a"/>
    <circle cx="12" cy="12" r="4.5" fill="#ffffff"/>
  </svg>`,
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

function MapClick({ onPick }: { onPick: (v: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Flies the map to `target` whenever its `key` changes — used for search picks
// and "use my location" (an intentional jump). Marker drag / map click bump no
// key, so the map stays put under the user's hand.
function FlyTo({ target }: { target: { point: LatLng; key: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.point.lat, target.point.lng], PIN_ZOOM, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function LocationPicker({ value, onChange, onResolve }: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ point: LatLng; key: number } | null>(null);
  const resolution = useRef(0), picked = useRef<LatLng | null>(value);
  useEffect(() => () => { resolution.current++; }, []);
  useEffect(() => {
    if (!value) { resolution.current++; picked.current = null; return; }
    if (picked.current?.lat !== value.lat || picked.current?.lng !== value.lng) {
      resolution.current++; picked.current = value; setFlyTarget({ point: value, key: Date.now() });
    }
  }, [value]);

  const reverse = useCallback(
    async (v: LatLng, revision: number) => {
      try {
        const res = await fetch(`/api/geocode?lat=${v.lat}&lng=${v.lng}`);
        const data = await res.json();
        if (resolution.current !== revision) return;
        if (!res.ok) { setStatus(data.error || "Address lookup unavailable; the map pin is kept."); return; }
        if (data.result) {
          setStatus(data.result.label);
          onResolve?.(data.result);
          return;
        }
      } catch {
        /* fall through */
      }
      if (resolution.current === revision) setStatus("Location pinned on map");
    },
    [onResolve],
  );

  // Drag / map-click: update the value and label, but don't move the map.
  const pick = useCallback(
    (v: LatLng) => {
      const revision = ++resolution.current; picked.current = v;
      onChange(v);
      void reverse(v, revision);
    },
    [onChange, reverse],
  );

  // Search pick / "use my location": update the value AND fly the map there.
  // `withReverse` is false when the caller already has the resolved address.
  const jumpTo = useCallback(
    (v: LatLng, withReverse = true) => {
      const revision = ++resolution.current; picked.current = v;
      onChange(v);
      setFlyTarget({ point: v, key: Date.now() });
      if (withReverse) void reverse(v, revision);
    },
    [onChange, reverse],
  );

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("Your browser can’t share a location.");
      return;
    }
    const revision = ++resolution.current;
    setLocating(true);
    setStatus("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolution.current !== revision) return;
        setLocating(false);
        jumpTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        if (resolution.current !== revision) return;
        setLocating(false);
        setStatus("Couldn’t get your location — search or tap the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const chooseResult = (place: LocationSuggestion) => {
    const point = locationPoint(place); if (!point) return;
    setLocating(false); setQuery(place.label); setStatus(place.label);
    jumpTo(point, false);
    onResolve?.({ label: place.label, name: place.name, city: place.city || "", state: place.state || "", pincode: place.pincode || "" });
  };
  const clear = () => {
    resolution.current++; picked.current = null; setLocating(false);
    onChange(null); setStatus(null); setQuery("");
  };

  const center: [number, number] = value ? [value.lat, value.lng] : INDIA_CENTER;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <LocationSearchInput aria-label="Search a public place or area" placeholder="Type a city, area or landmark" value={query} onValueChange={setQuery} onChoose={chooseResult} />
        <p className="mt-1 text-xs text-muted">Suggestions appear as you type. Search public places only; do not include personal details.</p>
      </div>

      <div className="h-64 w-full overflow-hidden rounded-xl border border-line">
        <MapContainer center={center} zoom={value ? PIN_ZOOM : DEFAULT_ZOOM} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClick onPick={pick} />
          <FlyTo target={flyTarget} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend(e) {
                  const ll = (e.target as L.Marker).getLatLng();
                  pick({ lat: ll.lat, lng: ll.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          iconLeft="map-pin"
          onClick={useMyLocation}
          disabled={locating}
        >
          {locating ? "Locating…" : "Use my location"}
        </Button>
        {value && (
          <button data-ui-action=""
            type="button"
            onClick={clear}
            className="text-xs font-medium text-muted underline hover:text-fg"
          >
            Clear location
          </button>
        )}
        {status && <span className="text-xs text-muted">📍 {status}</span>}
      </div>
    </div>
  );
}
