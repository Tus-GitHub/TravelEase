"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import { fieldBase } from "./FormField";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ResolvedPlace {
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
  const [results, setResults] = useState<Array<LatLng & ResolvedPlace>>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ point: LatLng; key: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  // Set right before we programmatically change `query` (e.g. on result pick) so
  // the debounced search doesn't immediately re-run and re-open the dropdown.
  const skipSearchRef = useRef(false);

  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (q.length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const reverse = useCallback(
    async (v: LatLng) => {
      try {
        const res = await fetch(`/api/geocode?lat=${v.lat}&lng=${v.lng}`);
        const data = await res.json();
        if (data.result) {
          setStatus(data.result.label);
          onResolve?.(data.result);
          return;
        }
      } catch {
        /* fall through */
      }
      setStatus("Location pinned on map");
    },
    [onResolve],
  );

  // Drag / map-click: update the value and label, but don't move the map.
  const pick = useCallback(
    (v: LatLng) => {
      onChange(v);
      void reverse(v);
    },
    [onChange, reverse],
  );

  // Search pick / "use my location": update the value AND fly the map there.
  // `withReverse` is false when the caller already has the resolved address.
  const jumpTo = useCallback(
    (v: LatLng, withReverse = true) => {
      onChange(v);
      setFlyTarget({ point: v, key: Date.now() });
      if (withReverse) void reverse(v);
    },
    [onChange, reverse],
  );

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("Your browser can’t share a location.");
      return;
    }
    setLocating(true);
    setStatus("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        jumpTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setStatus("Couldn’t get your location — search or tap the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const chooseResult = (r: LatLng & ResolvedPlace) => {
    skipSearchRef.current = true; // don't let the label we just set re-trigger a search
    setQuery(r.label);
    setResults([]);
    setOpen(false);
    setStatus(r.label);
    onResolve?.({ label: r.label, city: r.city, state: r.state, pincode: r.pincode });
    jumpTo({ lat: r.lat, lng: r.lng }, false);
  };

  const clear = () => {
    onChange(null);
    setStatus(null);
    setQuery("");
    setResults([]);
  };

  const center: [number, number] = value ? [value.lat, value.lng] : INDIA_CENTER;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative z-[1200]">
        <span className="relative block">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            placeholder="Search a place or address"
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            className={`${fieldBase} pr-9`}
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              …
            </span>
          )}
        </span>
        {open && results.length > 0 && (
          <ul className="absolute left-0 right-0 z-[1200] mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lng},${i}`}>
                <button
                  type="button"
                  onClick={() => chooseResult(r)}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="h-64 w-full overflow-hidden rounded-xl border border-slate-200">
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
          <button
            type="button"
            onClick={clear}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
          >
            Clear location
          </button>
        )}
        {status && <span className="text-xs text-slate-500">📍 {status}</span>}
      </div>
    </div>
  );
}
