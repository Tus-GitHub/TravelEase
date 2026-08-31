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

interface VehicleType {
  id: number;
  slug: string;
  title: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
}

interface Vehicle {
  id: number;
  vehicleTypeId: number;
  vehicleTypeTitle: string;
  name: string;
  registrationNumber: string;
  seatingCapacity: number;
  features: string[];
  basePricePerDay: number;
  isAvailable: boolean;
}

type Tab = "types" | "vehicles";

function VehicleTypesTab() {
  const r = useAdminResource<VehicleType>("/api/admin/vehicle-types");
  const form = useCrudForm({
    empty: { title: "", slug: "", description: "" },
    onCreate: (d) => r.create(d),
    onUpdate: (id, d) => r.update(id, d),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{r.items.length} vehicle types</p>
        <Button
          variant="accent"
          size="sm"
          iconLeft="tag"
          onClick={() => (form.open ? form.cancel() : form.startCreate())}
        >
          {form.open ? "Cancel" : "Add Vehicle Type"}
        </Button>
      </div>

      {r.error && <ErrorNote message={r.error} />}

      {form.open && (
        <Card padded hover={false} className="mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.submit();
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <FormField label="Title" icon="tag">
              <input
                required
                value={form.draft.title}
                onChange={(e) => form.patch({ title: e.target.value })}
                className={fieldBase}
                placeholder="e.g. Mini Bus"
              />
            </FormField>
            <FormField label="Slug" icon="tag">
              <input
                value={form.draft.slug}
                onChange={(e) => form.patch({ slug: e.target.value })}
                className={fieldBase}
                placeholder="auto-generated if blank"
              />
            </FormField>
            <FormField label="Description" icon="tag">
              <input
                value={form.draft.description}
                onChange={(e) => form.patch({ description: e.target.value })}
                className={fieldBase}
                placeholder="Short description"
              />
            </FormField>
            {form.error && <div className="sm:col-span-3"><ErrorNote message={form.error} /></div>}
            <div className="flex gap-2 sm:col-span-3">
              <Button type="submit" variant="primary" size="sm" disabled={form.saving}>
                {form.saving ? "Saving…" : form.editingId == null ? "Add type" : "Save changes"}
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
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Slug</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Active</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {r.items.map((t) => (
                <tr key={t.id} className="hover:bg-surface-hover/60">
                  <td className="px-5 py-3.5 font-medium text-fg">{t.title}</td>
                  <td className="px-5 py-3.5 text-muted">{t.slug}</td>
                  <td className="px-5 py-3.5 text-muted">{t.description || "—"}</td>
                  <td className="px-5 py-3.5">
                    <Toggle
                      on={t.isActive}
                      onChange={(next) => r.update(t.id, { isActive: next })}
                      label="Toggle active"
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <RowActions
                      onEdit={() =>
                        form.startEdit(t.id, {
                          title: t.title,
                          slug: t.slug,
                          description: t.description,
                        })
                      }
                      onDelete={() => r.remove(t.id)}
                    />
                  </td>
                </tr>
              ))}
              <EmptyRow show={!r.loading && r.items.length === 0} cols={5} label="No vehicle types yet." />
              <LoadingRow show={r.loading} cols={5} />
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function VehiclesTab() {
  const types = useAdminResource<VehicleType>("/api/admin/vehicle-types");
  const r = useAdminResource<Vehicle>("/api/admin/vehicles");
  const form = useCrudForm({
    empty: {
      vehicleTypeId: "",
      name: "",
      registrationNumber: "",
      seatingCapacity: "",
      basePricePerDay: "",
      features: "",
    },
    onCreate: (d) => r.create(toBody(d)),
    onUpdate: (id, d) => r.update(id, toBody(d)),
  });

  const typeTitle = useMemo(() => {
    const map = new Map(types.items.map((t) => [t.id, t.title]));
    return (id: number) => map.get(id) ?? "—";
  }, [types.items]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{r.items.length} vehicles in the fleet</p>
        <Button
          variant="accent"
          size="sm"
          iconLeft="car"
          onClick={() => (form.open ? form.cancel() : form.startCreate())}
        >
          {form.open ? "Cancel" : "Add Vehicle"}
        </Button>
      </div>

      {r.error && <ErrorNote message={r.error} />}

      {form.open && (
        <Card padded hover={false} className="mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.submit();
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <FormField label="Name" icon="car">
              <input
                required
                value={form.draft.name}
                onChange={(e) => form.patch({ name: e.target.value })}
                className={fieldBase}
                placeholder="e.g. Toyota Innova Crysta"
              />
            </FormField>
            <FormField label="Vehicle Type" icon="tag">
              <select
                required
                value={form.draft.vehicleTypeId}
                onChange={(e) => form.patch({ vehicleTypeId: e.target.value })}
                className={`${fieldBase} appearance-none`}
              >
                <option value="" disabled>
                  Select type
                </option>
                {types.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Registration No." icon="tag">
              <input
                value={form.draft.registrationNumber}
                onChange={(e) => form.patch({ registrationNumber: e.target.value })}
                className={fieldBase}
                placeholder="KA01AB1234"
              />
            </FormField>
            <FormField label="Seating Capacity" icon="seat">
              <input
                type="number"
                min={1}
                required
                value={form.draft.seatingCapacity}
                onChange={(e) => form.patch({ seatingCapacity: e.target.value })}
                className={fieldBase}
                placeholder="7"
              />
            </FormField>
            <FormField label="Price / Day (₹)" icon="tag">
              <input
                type="number"
                min={0}
                required
                value={form.draft.basePricePerDay}
                onChange={(e) => form.patch({ basePricePerDay: e.target.value })}
                className={fieldBase}
                placeholder="4200"
              />
            </FormField>
            <FormField label="Features (comma-separated)" icon="tag">
              <input
                value={form.draft.features}
                onChange={(e) => form.patch({ features: e.target.value })}
                className={fieldBase}
                placeholder="AC, Wi-Fi, Music System"
              />
            </FormField>
            {form.error && (
              <div className="sm:col-span-2 lg:col-span-3">
                <ErrorNote message={form.error} />
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" variant="primary" size="sm" disabled={form.saving}>
                {form.saving ? "Saving…" : form.editingId == null ? "Add vehicle" : "Save changes"}
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
                <th className="px-5 py-3">Vehicle</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Reg. No.</th>
                <th className="px-5 py-3">Seats</th>
                <th className="px-5 py-3">Price / Day</th>
                <th className="px-5 py-3">Available</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {r.items.map((v) => (
                <tr key={v.id} className="hover:bg-surface-hover/60">
                  <td className="px-5 py-3.5 font-medium text-fg">{v.name}</td>
                  <td className="px-5 py-3.5 text-muted">
                    {v.vehicleTypeTitle || typeTitle(v.vehicleTypeId)}
                  </td>
                  <td className="px-5 py-3.5 text-muted">{v.registrationNumber || "—"}</td>
                  <td className="px-5 py-3.5 text-muted">{v.seatingCapacity}</td>
                  <td className="px-5 py-3.5 text-muted">
                    ₹{v.basePricePerDay.toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3.5">
                    <Toggle
                      on={v.isAvailable}
                      onChange={(next) => r.update(v.id, { isAvailable: next })}
                      label="Toggle availability"
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <RowActions
                      onEdit={() =>
                        form.startEdit(v.id, {
                          vehicleTypeId: String(v.vehicleTypeId),
                          name: v.name,
                          registrationNumber: v.registrationNumber,
                          seatingCapacity: String(v.seatingCapacity),
                          basePricePerDay: String(v.basePricePerDay),
                          features: v.features.join(", "),
                        })
                      }
                      onDelete={() => r.remove(v.id)}
                    />
                  </td>
                </tr>
              ))}
              <EmptyRow show={!r.loading && r.items.length === 0} cols={7} label="No vehicles yet." />
              <LoadingRow show={r.loading} cols={7} />
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function toBody(d: {
  vehicleTypeId: string;
  name: string;
  registrationNumber: string;
  seatingCapacity: string;
  basePricePerDay: string;
  features: string;
}) {
  return {
    vehicleTypeId: Number(d.vehicleTypeId),
    name: d.name,
    registrationNumber: d.registrationNumber,
    seatingCapacity: Number(d.seatingCapacity),
    basePricePerDay: Number(d.basePricePerDay),
    features: d.features
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export default function AdminVehiclesPage() {
  const { isLoading, allowed } = useAdminSectionGuard("vehicles");
  const [tab, setTab] = useState<Tab>("types");

  if (isLoading || !allowed) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Fleet</h1>
        <p className="text-sm text-muted">Manage vehicle types and the vehicles fleet.</p>
      </header>

      <AdminTabs
        tabs={[
          { id: "types", label: "Vehicle Types" },
          { id: "vehicles", label: "Vehicles" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "types" ? <VehicleTypesTab /> : <VehiclesTab />}
    </div>
  );
}
