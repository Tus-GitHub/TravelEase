"use client";

import { useMemo, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import FormField, { fieldBase } from "@/components/forms/FormField";
import RowActions from "@/components/admin/RowActions";
import { ErrorNote, EmptyRow, LoadingRow } from "@/components/admin/tableBits";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";
import { useAdminResource } from "@/lib/admin/useAdminResource";
import { useCrudForm } from "@/lib/admin/useCrudForm";

interface Region {
  id: number;
  name: string;
}
interface VehicleType {
  id: number;
  title: string;
}
interface TouristSpot {
  id: number;
  name: string;
  cityName: string;
}
interface PackageStop {
  id: number;
  touristSpotId: number;
  touristSpotName: string;
  stopOrder: number;
  nightsHere: number;
}
interface CataloguePackage {
  id: number;
  regionId: number;
  regionName: string;
  vehicleTypeId: number;
  vehicleTypeTitle: string;
  name: string;
  durationDays: number;
  maxPersons: number;
  pricePerPerson: number;
  tag: string;
  rating: number | null;
  isActive: boolean;
  stops: PackageStop[];
}

export default function AdminPackagesPage() {
  const { isLoading, allowed } = useAdminSectionGuard("packages");
  const regions = useAdminResource<Region>("/api/admin/regions");
  const types = useAdminResource<VehicleType>("/api/admin/vehicle-types");
  const spots = useAdminResource<TouristSpot>("/api/admin/tourist-spots");
  const r = useAdminResource<CataloguePackage>("/api/admin/packages");

  const [expanded, setExpanded] = useState<number | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);

  const form = useCrudForm({
    empty: {
      regionId: "",
      vehicleTypeId: "",
      name: "",
      durationDays: "",
      maxPersons: "",
      pricePerPerson: "",
      tag: "",
      rating: "",
    },
    onCreate: (d) => r.create(toBody(d)),
    onUpdate: (id, d) => r.update(id, toBody(d)),
  });

  const regionName = useMemo(() => {
    const map = new Map(regions.items.map((x) => [x.id, x.name]));
    return (id: number) => map.get(id) ?? "—";
  }, [regions.items]);
  const typeTitle = useMemo(() => {
    const map = new Map(types.items.map((x) => [x.id, x.title]));
    return (id: number) => map.get(id) ?? "—";
  }, [types.items]);

  const addStop = async (packageId: number, body: unknown) => {
    setStopError(null);
    const res = await fetch(`/api/admin/packages/${packageId}/stops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStopError(data.error || "Couldn't add stop.");
      return;
    }
    await r.refetch();
  };

  const removeStop = async (stopId: number) => {
    setStopError(null);
    const res = await fetch(`/api/admin/package-stops/${stopId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStopError(data.error || "Couldn't remove stop.");
      return;
    }
    await r.refetch();
  };

  if (isLoading || !allowed) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Packages</h1>
          <p className="text-sm text-muted">{r.items.length} curated packages</p>
        </div>
        <Button
          variant="accent"
          size="sm"
          iconLeft="tag"
          onClick={() => (form.open ? form.cancel() : form.startCreate())}
        >
          {form.open ? "Cancel" : "Add Package"}
        </Button>
      </header>

      {r.error && <ErrorNote message={r.error} />}
      {stopError && <ErrorNote message={stopError} />}

      {form.open && (
        <Card padded hover={false} className="mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.submit();
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <FormField label="Name" icon="tag">
              <input required value={form.draft.name} onChange={(e) => form.patch({ name: e.target.value })} className={fieldBase} placeholder="e.g. Coorg Coffee Trail" />
            </FormField>
            <FormField label="Region" icon="map-pin">
              <select required value={form.draft.regionId} onChange={(e) => form.patch({ regionId: e.target.value })} className={`${fieldBase} appearance-none`}>
                <option value="" disabled>Select region</option>
                {regions.items.map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Vehicle Type" icon="car">
              <select required value={form.draft.vehicleTypeId} onChange={(e) => form.patch({ vehicleTypeId: e.target.value })} className={`${fieldBase} appearance-none`}>
                <option value="" disabled>Select type</option>
                {types.items.map((x) => (
                  <option key={x.id} value={x.id}>{x.title}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Tag" icon="tag">
              <input value={form.draft.tag} onChange={(e) => form.patch({ tag: e.target.value })} className={fieldBase} placeholder="Popular / Premium / …" />
            </FormField>
            <FormField label="Duration (days)" icon="calendar">
              <input type="number" min={1} required value={form.draft.durationDays} onChange={(e) => form.patch({ durationDays: e.target.value })} className={fieldBase} placeholder="4" />
            </FormField>
            <FormField label="Max persons" icon="users">
              <input type="number" min={1} required value={form.draft.maxPersons} onChange={(e) => form.patch({ maxPersons: e.target.value })} className={fieldBase} placeholder="6" />
            </FormField>
            <FormField label="Price / person (₹)" icon="tag">
              <input type="number" min={0} required value={form.draft.pricePerPerson} onChange={(e) => form.patch({ pricePerPerson: e.target.value })} className={fieldBase} placeholder="8200" />
            </FormField>
            <FormField label="Rating (0–5)" icon="star">
              <input type="number" min={0} max={5} step={0.1} value={form.draft.rating} onChange={(e) => form.patch({ rating: e.target.value })} className={fieldBase} placeholder="4.7" />
            </FormField>
            {form.error && <div className="sm:col-span-2 lg:col-span-4"><ErrorNote message={form.error} /></div>}
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" variant="primary" size="sm" disabled={form.saving}>
                {form.saving ? "Saving…" : form.editingId == null ? "Add package" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={form.cancel}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Package</th>
                <th className="px-5 py-3">Region</th>
                <th className="px-5 py-3">Vehicle Type</th>
                <th className="px-5 py-3">Days</th>
                <th className="px-5 py-3">₹/person</th>
                <th className="px-5 py-3">Stops</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {r.items.map((p) => (
                <PackageRows
                  key={p.id}
                  pkg={p}
                  regionName={p.regionName || regionName(p.regionId)}
                  typeTitle={p.vehicleTypeTitle || typeTitle(p.vehicleTypeId)}
                  spots={spots.items}
                  expanded={expanded === p.id}
                  onToggleExpand={() => setExpanded(expanded === p.id ? null : p.id)}
                  onEdit={() =>
                    form.startEdit(p.id, {
                      regionId: String(p.regionId),
                      vehicleTypeId: String(p.vehicleTypeId),
                      name: p.name,
                      durationDays: String(p.durationDays),
                      maxPersons: String(p.maxPersons),
                      pricePerPerson: String(p.pricePerPerson),
                      tag: p.tag,
                      rating: p.rating != null ? String(p.rating) : "",
                    })
                  }
                  onDelete={() => r.remove(p.id)}
                  onAddStop={(body) => addStop(p.id, body)}
                  onRemoveStop={removeStop}
                />
              ))}
              <EmptyRow show={!r.loading && r.items.length === 0} cols={7} label="No packages yet." />
              <LoadingRow show={r.loading} cols={7} />
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PackageRows({
  pkg,
  regionName,
  typeTitle,
  spots,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddStop,
  onRemoveStop,
}: {
  pkg: CataloguePackage;
  regionName: string;
  typeTitle: string;
  spots: TouristSpot[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => Promise<{ ok: boolean; error?: string }>;
  onAddStop: (body: unknown) => Promise<void>;
  onRemoveStop: (stopId: number) => Promise<void>;
}) {
  const [stop, setStop] = useState({ touristSpotId: "", stopOrder: "", nightsHere: "0" });
  const [adding, setAdding] = useState(false);

  return (
    <>
      <tr className="hover:bg-surface-hover/60">
        <td className="px-5 py-3.5 font-medium text-fg">{pkg.name}</td>
        <td className="px-5 py-3.5 text-muted">{regionName}</td>
        <td className="px-5 py-3.5 text-muted">{typeTitle}</td>
        <td className="px-5 py-3.5 text-muted">{pkg.durationDays}</td>
        <td className="px-5 py-3.5 text-muted">₹{pkg.pricePerPerson.toLocaleString("en-IN")}</td>
        <td className="px-5 py-3.5">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
          >
            {pkg.stops.length} stop{pkg.stops.length === 1 ? "" : "s"}
            <Icon name="chevron-down" className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </td>
        <td className="px-5 py-3.5 text-right">
          <RowActions onEdit={onEdit} onDelete={onDelete} />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface-muted/60">
          <td colSpan={7} className="px-5 py-4">
            <ol className="mb-3 space-y-1.5">
              {pkg.stops.length === 0 && (
                <li className="text-xs text-faint">No stops added.</li>
              )}
              {pkg.stops.map((s) => (
                <li key={s.id} className="flex items-center gap-3 text-sm text-fg">
                  <span className="font-mono text-xs text-faint">#{s.stopOrder}</span>
                  {s.touristSpotName}
                  <span className="text-xs text-faint">
                    · {s.nightsHere} night{s.nightsHere === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveStop(s.id)}
                    className="text-xs text-faint hover:text-red-600"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ol>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!stop.touristSpotId || !stop.stopOrder) return;
                setAdding(true);
                await onAddStop({
                  touristSpotId: Number(stop.touristSpotId),
                  stopOrder: Number(stop.stopOrder),
                  nightsHere: Number(stop.nightsHere) || 0,
                });
                setAdding(false);
                setStop({ touristSpotId: "", stopOrder: "", nightsHere: "0" });
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <select
                value={stop.touristSpotId}
                onChange={(e) => setStop({ ...stop, touristSpotId: e.target.value })}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs"
                required
              >
                <option value="" disabled>Tourist spot</option>
                {spots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.cityName})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                required
                placeholder="Order"
                value={stop.stopOrder}
                onChange={(e) => setStop({ ...stop, stopOrder: e.target.value })}
                className="w-20 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs"
              />
              <input
                type="number"
                min={0}
                placeholder="Nights"
                value={stop.nightsHere}
                onChange={(e) => setStop({ ...stop, nightsHere: e.target.value })}
                className="w-20 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs"
              />
              <Button type="submit" variant="primary" size="sm" disabled={adding}>
                {adding ? "Adding…" : "Add stop"}
              </Button>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

function toBody(d: {
  regionId: string;
  vehicleTypeId: string;
  name: string;
  durationDays: string;
  maxPersons: string;
  pricePerPerson: string;
  tag: string;
  rating: string;
}) {
  return {
    regionId: Number(d.regionId),
    vehicleTypeId: Number(d.vehicleTypeId),
    name: d.name,
    durationDays: Number(d.durationDays),
    maxPersons: Number(d.maxPersons),
    pricePerPerson: Number(d.pricePerPerson),
    tag: d.tag,
    rating: d.rating.trim() === "" ? null : Number(d.rating),
  };
}
