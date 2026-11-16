"use client";
import Select from "@/components/controls/Select";


import dynamic from "next/dynamic";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import FormField, { fieldBase } from "@/components/forms/FormField";
import AdminTabs from "@/components/admin/AdminTabs";
import RowActions from "@/components/admin/RowActions";
import AdminEditor from "@/components/admin/AdminEditor";
import LocationSearchInput, { locationName, locationPoint, type LocationSuggestion } from "@/components/forms/LocationSearchInput";
import type { LatLng, ResolvedPlace } from "@/components/forms/LocationPicker";
import { matchingState, matchingCity } from "@/lib/geography";
import type { ImageKind } from "@/lib/image-upload";
import Toggle from "@/components/admin/Toggle";
import { ErrorNote, EmptyRow, LoadingRow } from "@/components/admin/tableBits";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";
import { useAdminResource } from "@/lib/admin/useAdminResource";
import { useCrudForm } from "@/lib/admin/useCrudForm";

const LocationPicker = dynamic(() => import("@/components/forms/LocationPicker"), { ssr: false, loading: () => <p className="text-sm text-muted">Loading map...</p> });

interface Region {
  id: number;
  name: string;
  state: string;
  isActive: boolean;
}
interface State { id: number; regionId: number; regionName: string; name: string; isActive: boolean }
interface City {
  id: number;
  stateId: number;
  stateName: string;
  regionId: number;
  regionName: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  isPickupPoint: boolean;
  isAirport: boolean;
}
interface TouristSpot {
  latitude: number | null;
  longitude: number | null;
  id: number;
  cityId: number;
  cityName: string;
  stateName: string;
  regionName: string;
  name: string;
  tag: string;
  description: string;
}

function GeoMap({ value, onChange, onResolve }: { value: LatLng | null; onChange: (point: LatLng | null) => void; onResolve: (place: ResolvedPlace) => void }) {
  const [open, setOpen] = useState(false);
  return <details className="min-w-0 rounded-xl border border-line p-4 sm:col-span-2" onToggle={event => setOpen(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-semibold text-fg">Choose on map (optional)</summary>{open && <div className="mt-4"><LocationPicker value={value} onChange={onChange} onResolve={onResolve} /></div>}</details>;
}
function draftPoint(latitude: string, longitude: string): LatLng | null {
  if (!latitude.trim() || !longitude.trim()) return null;
  return locationPoint({ label: "", lat: Number(latitude), lng: Number(longitude) });
}

type Tab = "regions" | "states" | "cities" | "spots";

function RegionsTab() {
  const r=useAdminResource<Region>("/api/admin/regions");
  const form=useCrudForm({empty:{name:""},onCreate:d=>r.create(d),onUpdate:(id,d)=>r.update(id,d)});
  return <div><SectionHead count={r.items.length+" regions"} open={form.open} onToggle={()=>form.open?form.cancel():form.startCreate()} addLabel="Add Region" icon="map-pin"/>
    <p className="mb-4 text-sm text-muted">Create each region once, such as North. Add its states in the States tab.</p>{r.error&&<ErrorNote message={r.error}/>}
    {form.open&&<FormCard title={form.editingId==null?"Add region":"Edit region"} image={form.editingId==null?undefined:{kind:"regions",id:form.editingId,name:form.draft.name}} onSubmit={form.submit} error={form.error} saving={form.saving} editing={form.editingId!=null} onCancel={form.cancel}>
      <FormField label="Region name" icon="map-pin"><input required minLength={2} maxLength={100} value={form.draft.name} onChange={e=>form.patch({name:e.target.value})} className={fieldBase} placeholder="e.g. North"/></FormField>
      <p className="text-sm text-muted">A region can contain many states. Names cannot be duplicated.</p>
    </FormCard>}
    <TableCard headers={["Region","States","Active","Actions"]}>{r.items.map(row=><tr key={row.id}><td className="px-5 py-3.5 font-medium text-fg">{row.name}</td><td className="px-5 py-3.5 text-muted">{row.state||"No states added"}</td><td className="px-5 py-3.5"><Toggle on={row.isActive} onChange={isActive=>r.update(row.id,{isActive})} label="Toggle active"/></td><td className="px-5 py-3.5"><RowActions name={row.name} onEdit={()=>form.startEdit(row.id,{name:row.name})} onDelete={()=>r.remove(row.id)}/></td></tr>)}<EmptyRow show={!r.loading&&!r.items.length} cols={4} label="No regions yet."/><LoadingRow show={r.loading} cols={4}/></TableCard>
  </div>;
}

function StatesTab() {
  const regions=useAdminResource<Region>("/api/admin/regions"),r=useAdminResource<State>("/api/admin/states");
  const form=useCrudForm({empty:{regionId:"",name:""},onCreate:d=>r.create({...d,regionId:Number(d.regionId)}),onUpdate:(id,d)=>r.update(id,{...d,regionId:Number(d.regionId)})});
  const [point,setPoint]=useState<LatLng|null>(null);useEffect(()=>setPoint(null),[form.open,form.editingId]);
  const choose=(place:LocationSuggestion)=>{form.patch({name:(place.state||locationName(place)).slice(0,100)});const p=locationPoint(place);if(p)setPoint(p);};
  return <div><SectionHead count={r.items.length+" states"} open={form.open} onToggle={()=>form.open?form.cancel():form.startCreate()} addLabel="Add State" icon="map-pin"/>
    <p className="mb-4 text-sm text-muted">Choose a region, then add a state or union territory. Cities will belong to this state.</p>{r.error&&<ErrorNote message={r.error}/>}{regions.error&&<ErrorNote message={regions.error}/>}
    {form.open&&<FormCard title={form.editingId==null?"Add state":"Edit state"} onSubmit={form.submit} error={form.error} saving={form.saving} editing={form.editingId!=null} onCancel={form.cancel}>
      <FormField label="Region" icon="map-pin"><Select required searchable value={form.draft.regionId} onChange={e=>form.patch({regionId:e.target.value})} className={fieldBase}><option value="" disabled>Select region</option>{regions.items.map(region=><option key={region.id} value={region.id}>{region.name}</option>)}</Select></FormField>
      <FormField label="State name" icon="location"><LocationSearchInput required mode="state" value={form.draft.name} onValueChange={name=>form.patch({name})} onChoose={choose} localOptions={r.items.map(state=>({label:state.name,name:state.name,state:state.name}))} maxLength={100} className={fieldBase} placeholder="Type a state or union territory"/></FormField>
      <GeoMap value={point} onChange={setPoint} onResolve={choose}/>
      <p className="text-xs leading-relaxed text-muted sm:col-span-2">Changing a state&apos;s region also moves its cities into that region. Existing city and booking IDs stay intact.</p>
    </FormCard>}
    <TableCard headers={["State","Region","Active","Actions"]}>{r.items.map(row=><tr key={row.id}><td className="px-5 py-3.5 font-medium text-fg">{row.name}</td><td className="px-5 py-3.5 text-muted">{row.regionName}</td><td className="px-5 py-3.5"><Toggle on={row.isActive} onChange={isActive=>r.update(row.id,{isActive})} label="Toggle active"/></td><td className="px-5 py-3.5"><RowActions name={row.name} onEdit={()=>form.startEdit(row.id,{regionId:String(row.regionId),name:row.name})} onDelete={()=>r.remove(row.id)}/></td></tr>)}<EmptyRow show={!r.loading&&!r.items.length} cols={4} label="No states yet. Add a region first, then its states."/><LoadingRow show={r.loading} cols={4}/></TableCard>
  </div>;
}

function CitiesTab() {
  const states = useAdminResource<State>("/api/admin/states");
  const r = useAdminResource<City>("/api/admin/cities");
  const form = useCrudForm({
    empty: {
      stateId: "",
      name: "",
      latitude: "",
      longitude: "",
      isPickupPoint: true,
      isAirport: false,
    },
    onCreate: (d) => r.create(toCityBody(d)),
    onUpdate: (id, d) => r.update(id, toCityBody(d)),
  });

  const choose = (place: LocationSuggestion) => {
    const point = locationPoint(place);
    form.patch({ name: (place.city || locationName(place)).slice(0,100), stateId: matchingState(states.items, place.state, form.draft.stateId), ...(point ? { latitude: String(point.lat), longitude: String(point.lng) } : {}) });
  };


  return (
    <div>
      <SectionHead
        count={`${r.items.length} cities`}
        open={form.open}
        onToggle={() => (form.open ? form.cancel() : form.startCreate())}
        addLabel="Add City"
        icon="location"
      />
      {r.error && <ErrorNote message={r.error} />}

      {form.open && (
        <FormCard onSubmit={form.submit} error={form.error} saving={form.saving} editing={form.editingId != null} onCancel={form.cancel}>
          <FormField label="State" icon="map-pin">
            <Select required value={form.draft.stateId} onChange={(e) => form.patch({ stateId: e.target.value })} className={`${fieldBase} appearance-none`}>
              <option value="" disabled>Select state</option>
              {states.items.map((x) => (
                <option key={x.id} value={x.id}>{x.name} · {x.regionName}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="City name" icon="location">
            <LocationSearchInput required mode="city" value={form.draft.name} onValueChange={name => form.patch({ name })} onChoose={choose} maxLength={100} className={fieldBase} placeholder="Type a city; select a suggestion to fill coordinates" />
          </FormField>
          <FormField label="Latitude" icon="map-pin">
            <input value={form.draft.latitude} onChange={(e) => form.patch({ latitude: e.target.value })} className={fieldBase} inputMode="decimal" placeholder="12.4244" />
          </FormField>
          <FormField label="Longitude" icon="map-pin">
            <input value={form.draft.longitude} onChange={(e) => form.patch({ longitude: e.target.value })} className={fieldBase} inputMode="decimal" placeholder="75.7382" />
          </FormField>
          <GeoMap value={draftPoint(form.draft.latitude, form.draft.longitude)} onChange={point => form.patch({ latitude: point ? String(point.lat) : "", longitude: point ? String(point.lng) : "" })} onResolve={choose} />
          <p className="text-xs text-muted sm:col-span-2">Choosing a city fills its coordinates and matching state. Its region is derived automatically. If no state matches, add it in States first.</p>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={form.draft.isPickupPoint} onChange={(e) => form.patch({ isPickupPoint: e.target.checked })} className="h-4 w-4 accent-primary-600" />
            Pickup point
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={form.draft.isAirport} onChange={(e) => form.patch({ isAirport: e.target.checked })} className="h-4 w-4 accent-primary-600" />
            Has airport
          </label>
        </FormCard>
      )}

      <TableCard headers={["City", "State / Region", "Coordinates", "Pickup", "Airport", "Actions"]}>
        {r.items.map((row) => (
          <tr key={row.id} className="hover:bg-surface-hover/60">
            <td className="px-5 py-3.5 font-medium text-fg">{row.name}</td>
            <td className="px-5 py-3.5 text-muted">{row.stateName}<span className="mt-1 block text-xs">{row.regionName}</span></td>
            <td className="px-5 py-3.5 text-muted">
              {row.latitude != null && row.longitude != null
                ? `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}`
                : "—"}
            </td>
            <td className="px-5 py-3.5 text-muted">{row.isPickupPoint ? "Yes" : "No"}</td>
            <td className="px-5 py-3.5 text-muted">{row.isAirport ? "Yes" : "No"}</td>
            <td className="px-5 py-3.5 text-right">
              <RowActions name={row.name}
                onEdit={() =>
                  form.startEdit(row.id, {
                    stateId: String(row.stateId),
                    name: row.name,
                    latitude: row.latitude != null ? String(row.latitude) : "",
                    longitude: row.longitude != null ? String(row.longitude) : "",
                    isPickupPoint: row.isPickupPoint,
                    isAirport: row.isAirport,
                  })
                }
                onDelete={() => r.remove(row.id)}
              />
            </td>
          </tr>
        ))}
        <EmptyRow show={!r.loading && r.items.length === 0} cols={6} label="No cities yet." />
        <LoadingRow show={r.loading} cols={6} />
      </TableCard>
    </div>
  );
}

function SpotsTab() {
  const cities = useAdminResource<City>("/api/admin/cities");
  const r = useAdminResource<TouristSpot>("/api/admin/tourist-spots");
  const form = useCrudForm({
    empty: { cityId: "", name: "", tag: "", description: "", latitude: "", longitude: "" },
    onCreate: (d) => r.create({ ...d, cityId: Number(d.cityId), latitude: d.latitude.trim() === "" ? null : Number(d.latitude), longitude: d.longitude.trim() === "" ? null : Number(d.longitude) }),
    onUpdate: (id, d) => r.update(id, { ...d, cityId: Number(d.cityId), latitude: d.latitude.trim() === "" ? null : Number(d.latitude), longitude: d.longitude.trim() === "" ? null : Number(d.longitude) }),
  });

  const choose = (place: LocationSuggestion) => {
    const point = locationPoint(place);
    const cityId = matchingCity(cities.items, place.city || locationName(place), place.state, form.draft.cityId);
    form.patch({ name: locationName(place).slice(0,100), ...(place.city ? { cityId: cityId } : {}), ...(point ? { latitude: String(point.lat), longitude: String(point.lng) } : {}) });
  };

  const cityName = useMemo(() => {
    const map = new Map(cities.items.map((x) => [x.id, x.name]));
  return (id: number) => map.get(id) ?? "—";
  }, [cities.items]);

  return (
    <div>
      <SectionHead
        count={`${r.items.length} tourist spots`}
        open={form.open}
        onToggle={() => (form.open ? form.cancel() : form.startCreate())}
        addLabel="Add Tourist Spot"
        icon="star"
      />
      {r.error && <ErrorNote message={r.error} />}

      {form.open && (
        <FormCard title={form.editingId == null ? "Add tourist spot" : `Edit ${form.draft.name}`} image={form.editingId == null ? undefined : { kind: "tourist-spots", id: form.editingId, name: form.draft.name }} onSubmit={form.submit} error={form.error} saving={form.saving} editing={form.editingId != null} onCancel={form.cancel}>
          <FormField label="City" icon="location">
            <Select required value={form.draft.cityId} onChange={(e) => form.patch({ cityId: e.target.value })} className={`${fieldBase} appearance-none`}>
              <option value="" disabled>Select city</option>
              {cities.items.map((x) => (
                <option key={x.id} value={x.id}>{x.name} · {x.stateName} · {x.regionName}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Spot name" icon="star">
            <LocationSearchInput required value={form.draft.name} onValueChange={name => form.patch({ name })} onChoose={choose} maxLength={100} className={fieldBase} placeholder="Type a destination or landmark" />
          </FormField>
          <FormField label="Tag" icon="tag">
            <input value={form.draft.tag} onChange={(e) => form.patch({ tag: e.target.value })} className={fieldBase} placeholder="e.g. Waterfall" />
          </FormField>
          <FormField label="Description" icon="tag">
            <input value={form.draft.description} onChange={(e) => form.patch({ description: e.target.value })} className={fieldBase} placeholder="Short description" />
          </FormField>
          <FormField label="Latitude" icon="map-pin"><input type="number" min={-90} max={90} step="any" value={form.draft.latitude} onChange={e => form.patch({ latitude: e.target.value })} className={fieldBase} /></FormField>
          <FormField label="Longitude" icon="map-pin"><input type="number" min={-180} max={180} step="any" value={form.draft.longitude} onChange={e => form.patch({ longitude: e.target.value })} className={fieldBase} /></FormField>
          <GeoMap value={draftPoint(form.draft.latitude, form.draft.longitude)} onChange={point => form.patch({ latitude: point ? String(point.lat) : "", longitude: point ? String(point.lng) : "" })} onResolve={choose} />
          <p className="text-xs text-muted sm:col-span-2">Select a suggestion or map point to fill the name and coordinates. Choose its existing catalogue city before saving; no city is created automatically.</p>
        </FormCard>
      )}

      <TableCard headers={["Spot", "City", "Tag", "Actions"]}>
        {r.items.map((row) => (
          <tr key={row.id} className="hover:bg-surface-hover/60">
              <td className="px-5 py-3.5 font-medium text-fg">{row.name}<p className="mt-1 text-xs font-normal text-muted">{row.latitude != null && row.longitude != null ? "Map pin set" : "Map pin needed"}</p></td>
            <td className="px-5 py-3.5 text-muted">{row.cityName || cityName(row.cityId)}<span className="mt-1 block text-xs">{row.stateName} · {row.regionName}</span></td>
            <td className="px-5 py-3.5 text-muted">{row.tag || "—"}</td>
            <td className="px-5 py-3.5 text-right">
              <RowActions name={row.name}
                onEdit={() =>
                  form.startEdit(row.id, {
                    latitude: row.latitude == null ? "" : String(row.latitude),
                    longitude: row.longitude == null ? "" : String(row.longitude),
                    cityId: String(row.cityId),
                    name: row.name,
                    tag: row.tag,
                    description: row.description,
                  })
                }
                onDelete={() => r.remove(row.id)}
              />
            </td>
          </tr>
        ))}
        <EmptyRow show={!r.loading && r.items.length === 0} cols={4} label="No tourist spots yet." />
        <LoadingRow show={r.loading} cols={4} />
      </TableCard>
    </div>
  );
}

function toCityBody(d: {
  stateId: string;
  name: string;
  latitude: string;
  longitude: string;
  isPickupPoint: boolean;
  isAirport: boolean;
}) {
  return {
    stateId: Number(d.stateId),
    name: d.name,
    latitude: d.latitude.trim() === "" ? null : Number(d.latitude),
    longitude: d.longitude.trim() === "" ? null : Number(d.longitude),
    isPickupPoint: d.isPickupPoint,
    isAirport: d.isAirport,
  };
}

export default function AdminGeographyPage() {
  const { isLoading, allowed } = useAdminSectionGuard("geography");
  const [tab, setTab] = useState<Tab>("regions");

  if (isLoading || !allowed) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div>
      <AdminPageHeader className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Geography</h1>
        <p className="text-sm text-muted">Region → State → City → Tourist spot. Each place is added once under its parent.</p>
      </AdminPageHeader>

      <AdminTabs
        tabs={[
          { id: "regions", label: "Regions" },
          { id: "states", label: "States" },
          { id: "cities", label: "Cities" },
          { id: "spots", label: "Tourist Spots" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "regions" ? <RegionsTab /> : tab === "states" ? <StatesTab /> : tab === "cities" ? <CitiesTab /> : <SpotsTab />}
    </div>
  );
}

// ─── shared layout bits (geography only) ─────────────────────────────────────

function SectionHead({
  count,
  open,
  onToggle,
  addLabel,
  icon,
}: {
  count: string;
  open: boolean;
  onToggle: () => void;
  addLabel: string;
  icon: "map-pin" | "location" | "star";
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <p className="text-sm text-muted">{count}</p>
      <Button variant="accent" size="sm" iconLeft={icon} onClick={onToggle}>
        {open ? "Cancel" : addLabel}
      </Button>
    </div>
  );
}

function FormCard({
  title = "City details",
  image,
  children,
  onSubmit,
  error,
  saving,
  editing,
  onCancel,
}: {
  title?: string;
  image?: { kind: ImageKind; id: number; name: string };
  children: React.ReactNode;
  onSubmit: () => void;
  error: string | null;
  saving: boolean;
  editing: boolean;
  onCancel: () => void;
}) {
  return (
    <AdminEditor title={title} image={image} onClose={onCancel} busy={saving}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {children}
        {error && (
          <div className="sm:col-span-2">
            <ErrorNote message={error} />
          </div>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </AdminEditor>
  );
}

function TableCard({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <Card hover={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className={`px-5 py-3 ${h === "Actions" ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">{children}</tbody>
        </table>
      </div>
    </Card>
  );
}
