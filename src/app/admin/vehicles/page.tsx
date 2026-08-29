"use client";

import { useMemo, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import FormField, { fieldBase } from "@/components/forms/FormField";
import AdminTabs from "@/components/admin/AdminTabs";
import {
  mockVehicleTypes,
  mockVehicles,
  type AdminVehicleTypeRow,
  type AdminVehicleRow,
} from "@/lib/admin/mockData";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";

const emptyTypeForm = { title: "", slug: "", description: "" };
const emptyVehicleForm = { name: "", vehicleTypeId: "", registrationNumber: "", seatingCapacity: "", basePricePerDay: "" };

type Tab = "types" | "vehicles";

function VehicleTypesTab() {
  const [types, setTypes] = useState<AdminVehicleTypeRow[]>(mockVehicleTypes);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyTypeForm);

  const toggleActive = (id: string) => {
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t)));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setTypes((prev) => [
      ...prev,
      {
        id: `vt-${Date.now()}`,
        title: form.title.trim(),
        slug: form.slug.trim() || form.title.trim().toLowerCase().replace(/\s+/g, "-"),
        description: form.description.trim(),
        displayOrder: prev.length + 1,
        isActive: true,
      },
    ]);
    setForm(emptyTypeForm);
    setIsFormOpen(false);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{types.length} vehicle types</p>
        <Button variant="accent" size="sm" iconLeft="tag" onClick={() => setIsFormOpen((v) => !v)}>
          {isFormOpen ? "Cancel" : "Add Vehicle Type"}
        </Button>
      </div>

      {isFormOpen && (
        <Card padded hover={false} className="mb-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Title" icon="tag">
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={fieldBase}
                placeholder="e.g. Mini Bus"
              />
            </FormField>
            <FormField label="Slug" icon="tag">
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className={fieldBase}
                placeholder="auto-generated if left blank"
              />
            </FormField>
            <FormField label="Description" icon="tag">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={fieldBase}
                placeholder="Short description"
              />
            </FormField>
            <div className="sm:col-span-3">
              <Button type="submit" variant="primary" size="sm">Save Vehicle Type</Button>
            </div>
          </form>
        </Card>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Slug</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {types.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{t.title}</td>
                  <td className="px-5 py-3.5 text-slate-500">{t.slug}</td>
                  <td className="px-5 py-3.5 text-slate-600">{t.description}</td>
                  <td className="px-5 py-3.5 text-slate-600">{t.displayOrder}</td>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleActive(t.id)}
                      aria-pressed={t.isActive}
                      aria-label="Toggle active"
                      className={`relative h-6 w-11 rounded-full transition-colors ${t.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${t.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function VehiclesTab() {
  const [types] = useState<AdminVehicleTypeRow[]>(mockVehicleTypes);
  const [vehicles, setVehicles] = useState<AdminVehicleRow[]>(mockVehicles);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyVehicleForm);

  const typeTitle = useMemo(() => {
    const map = new Map(types.map((t) => [t.id, t.title]));
    return (id: string) => map.get(id) ?? "—";
  }, [types]);

  const toggleAvailability = (id: string) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, isAvailable: !v.isAvailable } : v)));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.vehicleTypeId) return;

    setVehicles((prev) => [
      {
        id: `veh-${Date.now()}`,
        vehicleTypeId: form.vehicleTypeId,
        name: form.name.trim(),
        registrationNumber: form.registrationNumber.trim(),
        seatingCapacity: Number(form.seatingCapacity) || 4,
        features: [],
        basePricePerDay: Number(form.basePricePerDay) || 0,
        rating: 0,
        isAvailable: true,
        images: [],
      },
      ...prev,
    ]);
    setForm(emptyVehicleForm);
    setIsFormOpen(false);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{vehicles.length} vehicles in the fleet</p>
        <Button variant="accent" size="sm" iconLeft="car" onClick={() => setIsFormOpen((v) => !v)}>
          {isFormOpen ? "Cancel" : "Add Vehicle"}
        </Button>
      </div>

      {isFormOpen && (
        <Card padded hover={false} className="mb-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <FormField label="Name" icon="car">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldBase}
                placeholder="e.g. Toyota Innova Crysta"
              />
            </FormField>
            <FormField label="Vehicle Type" icon="tag">
              <select
                required
                value={form.vehicleTypeId}
                onChange={(e) => setForm({ ...form, vehicleTypeId: e.target.value })}
                className={`${fieldBase} appearance-none`}
              >
                <option value="" disabled>Select type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Registration No." icon="tag">
              <input
                value={form.registrationNumber}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                className={fieldBase}
                placeholder="KA01AB1234"
              />
            </FormField>
            <FormField label="Seating Capacity" icon="seat">
              <input
                type="number"
                min={1}
                value={form.seatingCapacity}
                onChange={(e) => setForm({ ...form, seatingCapacity: e.target.value })}
                className={fieldBase}
                placeholder="7"
              />
            </FormField>
            <FormField label="Price / Day (₹)" icon="tag">
              <input
                type="number"
                min={0}
                value={form.basePricePerDay}
                onChange={(e) => setForm({ ...form, basePricePerDay: e.target.value })}
                className={fieldBase}
                placeholder="4200"
              />
            </FormField>
            <div className="sm:col-span-2 lg:col-span-5">
              <Button type="submit" variant="primary" size="sm">Save Vehicle</Button>
            </div>
          </form>
        </Card>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Vehicle</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Reg. No.</th>
                <th className="px-5 py-3">Seats</th>
                <th className="px-5 py-3">Price / Day</th>
                <th className="px-5 py-3">Images</th>
                <th className="px-5 py-3">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{v.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{typeTitle(v.vehicleTypeId)}</td>
                  <td className="px-5 py-3.5 text-slate-500">{v.registrationNumber || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-600">{v.seatingCapacity}</td>
                  <td className="px-5 py-3.5 text-slate-600">₹{v.basePricePerDay.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3.5 text-slate-500">{v.images.length}</td>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleAvailability(v.id)}
                      aria-pressed={v.isAvailable}
                      aria-label="Toggle availability"
                      className={`relative h-6 w-11 rounded-full transition-colors ${v.isAvailable ? "bg-emerald-500" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${v.isAvailable ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function AdminVehiclesPage() {
  const { isLoading, allowed } = useAdminSectionGuard("vehicles");
  const [tab, setTab] = useState<Tab>("types");

  if (isLoading || !allowed) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Fleet</h1>
        <p className="text-sm text-slate-500">Manage vehicle types and the vehicles fleet.</p>
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

      <p className="mt-3 text-xs text-slate-400">
        This is a UI preview — changes here aren&apos;t saved yet.
      </p>
    </div>
  );
}
