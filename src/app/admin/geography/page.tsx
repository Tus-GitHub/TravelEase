"use client";

import { useMemo, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import FormField, { fieldBase } from "@/components/forms/FormField";
import AdminTabs from "@/components/admin/AdminTabs";
import RowActions from "@/components/admin/RowActions";
import Toggle from "@/components/admin/Toggle";
import { ErrorNote, EmptyRow, LoadingRow } from "@/components/admin/tableBits";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";
import { useAdminResource } from "@/lib/admin/useAdminResource";
import { useCrudForm } from "@/lib/admin/useCrudForm";

interface Region {
  id: number;
  name: string;
  state: string;
  isActive: boolean;
}
interface City {
  id: number;
  regionId: number;
  regionName: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  isPickupPoint: boolean;
  isAirport: boolean;
}
interface TouristSpot {
  id: number;
  cityId: number;
  cityName: string;
  name: string;
  tag: string;
  description: string;
}

type Tab = "regions" | "cities" | "spots";

function RegionsTab() {
  const r = useAdminResource<Region>("/api/admin/regions");
  const form = useCrudForm({
    empty: { name: "", state: "" },
    onCreate: (d) => r.create(d),
    onUpdate: (id, d) => r.update(id, d),
  });

  return (
    <div>
      <SectionHead
        count={`${r.items.length} regions`}
        open={form.open}
        onToggle={() => (form.open ? form.cancel() : form.startCreate())}
        addLabel="Add Region"
        icon="map-pin"
      />
      {r.error && <ErrorNote message={r.error} />}

      {form.open && (
        <FormCard onSubmit={form.submit} error={form.error} saving={form.saving} editing={form.editingId != null} onCancel={form.cancel}>
          <FormField label="Name" icon="map-pin">
            <input required value={form.draft.name} onChange={(e) => form.patch({ name: e.target.value })} className={fieldBase} placeholder="e.g. Coorg" />
          </FormField>
          <FormField label="State" icon="location">
            <input required value={form.draft.state} onChange={(e) => form.patch({ state: e.target.value })} className={fieldBase} placeholder="e.g. Karnataka" />
          </FormField>
        </FormCard>
      )}

      <TableCard headers={["Region", "State", "Active", "Actions"]}>
        {r.items.map((row) => (
          <tr key={row.id} className="hover:bg-surface-hover/60">
            <td className="px-5 py-3.5 font-medium text-fg">{row.name}</td>
            <td className="px-5 py-3.5 text-muted">{row.state}</td>
            <td className="px-5 py-3.5">
              <Toggle on={row.isActive} onChange={(next) => r.update(row.id, { isActive: next })} label="Toggle active" />
            </td>
            <td className="px-5 py-3.5 text-right">
              <RowActions
                onEdit={() => form.startEdit(row.id, { name: row.name, state: row.state })}
                onDelete={() => r.remove(row.id)}
              />
            </td>
          </tr>
        ))}
        <EmptyRow show={!r.loading && r.items.length === 0} cols={4} label="No regions yet." />
        <LoadingRow show={r.loading} cols={4} />
      </TableCard>
    </div>
  );
}

function CitiesTab() {
  const regions = useAdminResource<Region>("/api/admin/regions");
  const r = useAdminResource<City>("/api/admin/cities");
  const form = useCrudForm({
    empty: {
      regionId: "",
      name: "",
      latitude: "",
      longitude: "",
      isPickupPoint: true,
      isAirport: false,
    },
    onCreate: (d) => r.create(toCityBody(d)),
    onUpdate: (id, d) => r.update(id, toCityBody(d)),
  });

  const regionName = useMemo(() => {
    const map = new Map(regions.items.map((x) => [x.id, x.name]));
    return (id: number) => map.get(id) ?? "—";
  }, [regions.items]);

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
          <FormField label="Region" icon="map-pin">
            <select required value={form.draft.regionId} onChange={(e) => form.patch({ regionId: e.target.value })} className={`${fieldBase} appearance-none`}>
              <option value="" disabled>Select region</option>
              {regions.items.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="City name" icon="location">
            <input required value={form.draft.name} onChange={(e) => form.patch({ name: e.target.value })} className={fieldBase} placeholder="e.g. Madikeri" />
          </FormField>
          <FormField label="Latitude" icon="map-pin">
            <input value={form.draft.latitude} onChange={(e) => form.patch({ latitude: e.target.value })} className={fieldBase} inputMode="decimal" placeholder="12.4244" />
          </FormField>
          <FormField label="Longitude" icon="map-pin">
            <input value={form.draft.longitude} onChange={(e) => form.patch({ longitude: e.target.value })} className={fieldBase} inputMode="decimal" placeholder="75.7382" />
          </FormField>
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

      <TableCard headers={["City", "Region", "Coordinates", "Pickup", "Airport", "Actions"]}>
        {r.items.map((row) => (
          <tr key={row.id} className="hover:bg-surface-hover/60">
            <td className="px-5 py-3.5 font-medium text-fg">{row.name}</td>
            <td className="px-5 py-3.5 text-muted">{row.regionName || regionName(row.regionId)}</td>
            <td className="px-5 py-3.5 text-muted">
              {row.latitude != null && row.longitude != null
                ? `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}`
                : "—"}
            </td>
            <td className="px-5 py-3.5 text-muted">{row.isPickupPoint ? "Yes" : "No"}</td>
            <td className="px-5 py-3.5 text-muted">{row.isAirport ? "Yes" : "No"}</td>
            <td className="px-5 py-3.5 text-right">
              <RowActions
                onEdit={() =>
                  form.startEdit(row.id, {
                    regionId: String(row.regionId),
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
    empty: { cityId: "", name: "", tag: "", description: "" },
    onCreate: (d) => r.create({ ...d, cityId: Number(d.cityId) }),
    onUpdate: (id, d) => r.update(id, { ...d, cityId: Number(d.cityId) }),
  });

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
        <FormCard onSubmit={form.submit} error={form.error} saving={form.saving} editing={form.editingId != null} onCancel={form.cancel}>
          <FormField label="City" icon="location">
            <select required value={form.draft.cityId} onChange={(e) => form.patch({ cityId: e.target.value })} className={`${fieldBase} appearance-none`}>
              <option value="" disabled>Select city</option>
              {cities.items.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Spot name" icon="star">
            <input required value={form.draft.name} onChange={(e) => form.patch({ name: e.target.value })} className={fieldBase} placeholder="e.g. Abbey Falls" />
          </FormField>
          <FormField label="Tag" icon="tag">
            <input value={form.draft.tag} onChange={(e) => form.patch({ tag: e.target.value })} className={fieldBase} placeholder="e.g. Waterfall" />
          </FormField>
          <FormField label="Description" icon="tag">
            <input value={form.draft.description} onChange={(e) => form.patch({ description: e.target.value })} className={fieldBase} placeholder="Short description" />
          </FormField>
        </FormCard>
      )}

      <TableCard headers={["Spot", "City", "Tag", "Actions"]}>
        {r.items.map((row) => (
          <tr key={row.id} className="hover:bg-surface-hover/60">
            <td className="px-5 py-3.5 font-medium text-fg">{row.name}</td>
            <td className="px-5 py-3.5 text-muted">{row.cityName || cityName(row.cityId)}</td>
            <td className="px-5 py-3.5 text-muted">{row.tag || "—"}</td>
            <td className="px-5 py-3.5 text-right">
              <RowActions
                onEdit={() =>
                  form.startEdit(row.id, {
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
  regionId: string;
  name: string;
  latitude: string;
  longitude: string;
  isPickupPoint: boolean;
  isAirport: boolean;
}) {
  return {
    regionId: Number(d.regionId),
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
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Geography</h1>
        <p className="text-sm text-muted">Regions, cities and tourist spots.</p>
      </header>

      <AdminTabs
        tabs={[
          { id: "regions", label: "Regions" },
          { id: "cities", label: "Cities" },
          { id: "spots", label: "Tourist Spots" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "regions" ? <RegionsTab /> : tab === "cities" ? <CitiesTab /> : <SpotsTab />}
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
  children,
  onSubmit,
  error,
  saving,
  editing,
  onCancel,
}: {
  children: React.ReactNode;
  onSubmit: () => void;
  error: string | null;
  saving: boolean;
  editing: boolean;
  onCancel: () => void;
}) {
  return (
    <Card padded hover={false} className="mb-6">
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
    </Card>
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
