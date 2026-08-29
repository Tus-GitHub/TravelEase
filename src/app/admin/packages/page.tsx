"use client";

import { Fragment, useMemo, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import FormField, { fieldBase } from "@/components/forms/FormField";
import {
  mockPackages,
  mockRegions,
  mockVehicleTypes,
  mockTouristSpots,
  type AdminPackageRow,
  type AdminPackageTag,
} from "@/lib/admin/mockData";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";

const emptyForm = {
  name: "",
  regionId: "",
  vehicleTypeId: "",
  durationDays: "",
  maxPersons: "",
  pricePerPerson: "",
  tag: "Popular" as AdminPackageTag,
};

const emptyStopForm = { touristSpotId: "", nightsHere: "1" };

const tagStyles: Record<AdminPackageTag, string> = {
  Popular: "bg-accent-100 text-accent-700",
  "Best Value": "bg-emerald-100 text-emerald-700",
  Premium: "bg-primary-100 text-primary-800",
  Adventure: "bg-orange-100 text-orange-700",
};

export default function AdminPackagesPage() {
  const { isLoading, allowed } = useAdminSectionGuard("packages");
  const [packages, setPackages] = useState<AdminPackageRow[]>(mockPackages);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stopForm, setStopForm] = useState(emptyStopForm);

  const regionName = useMemo(() => {
    const map = new Map(mockRegions.map((r) => [r.id, r.name]));
    return (id: string) => map.get(id) ?? "—";
  }, []);

  const vehicleTypeTitle = useMemo(() => {
    const map = new Map(mockVehicleTypes.map((t) => [t.id, t.title]));
    return (id: string) => map.get(id) ?? "—";
  }, []);

  const spotName = useMemo(() => {
    const map = new Map(mockTouristSpots.map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? "—";
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.regionId || !form.vehicleTypeId) return;

    setPackages((prev) => [
      {
        id: `pkg-${Date.now()}`,
        regionId: form.regionId,
        vehicleTypeId: form.vehicleTypeId,
        name: form.name.trim(),
        durationDays: Number(form.durationDays) || 1,
        maxPersons: Number(form.maxPersons) || 1,
        pricePerPerson: Number(form.pricePerPerson) || 0,
        tag: form.tag,
        rating: 0,
        stops: [],
      },
      ...prev,
    ]);
    setForm(emptyForm);
    setIsFormOpen(false);
  };

  const handleAddStop = (packageId: string) => (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopForm.touristSpotId) return;

    setPackages((prev) =>
      prev.map((p) =>
        p.id === packageId
          ? {
              ...p,
              stops: [
                ...p.stops,
                {
                  touristSpotId: stopForm.touristSpotId,
                  stopOrder: p.stops.length + 1,
                  nightsHere: Number(stopForm.nightsHere) || 1,
                },
              ],
            }
          : p,
      ),
    );
    setStopForm(emptyStopForm);
  };

  if (isLoading || !allowed) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Packages</h1>
          <p className="text-sm text-slate-500">{packages.length} travel packages</p>
        </div>
        <Button
          variant="accent"
          size="sm"
          iconLeft="tag"
          onClick={() => setIsFormOpen((v) => !v)}
        >
          {isFormOpen ? "Cancel" : "Add Package"}
        </Button>
      </header>

      {isFormOpen && (
        <Card padded hover={false} className="mb-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Name" icon="tag">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldBase}
                placeholder="e.g. Goa Beach Hopper"
              />
            </FormField>
            <FormField label="Region" icon="map-pin">
              <select
                required
                value={form.regionId}
                onChange={(e) => setForm({ ...form, regionId: e.target.value })}
                className={`${fieldBase} appearance-none`}
              >
                <option value="" disabled>Select region</option>
                {mockRegions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Vehicle Type" icon="car">
              <select
                required
                value={form.vehicleTypeId}
                onChange={(e) => setForm({ ...form, vehicleTypeId: e.target.value })}
                className={`${fieldBase} appearance-none`}
              >
                <option value="" disabled>Select type</option>
                {mockVehicleTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Duration (days)" icon="calendar">
              <input
                type="number"
                min={1}
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                className={fieldBase}
                placeholder="5"
              />
            </FormField>
            <FormField label="Max Persons" icon="users">
              <input
                type="number"
                min={1}
                value={form.maxPersons}
                onChange={(e) => setForm({ ...form, maxPersons: e.target.value })}
                className={fieldBase}
                placeholder="6"
              />
            </FormField>
            <FormField label="Price / Person (₹)" icon="tag">
              <input
                type="number"
                min={0}
                value={form.pricePerPerson}
                onChange={(e) => setForm({ ...form, pricePerPerson: e.target.value })}
                className={fieldBase}
                placeholder="9999"
              />
            </FormField>
            <FormField label="Tag" icon="star">
              <select
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value as AdminPackageTag })}
                className={`${fieldBase} appearance-none`}
              >
                <option value="Popular">Popular</option>
                <option value="Best Value">Best Value</option>
                <option value="Premium">Premium</option>
                <option value="Adventure">Adventure</option>
              </select>
            </FormField>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" variant="primary" size="sm">
                Save Package
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Package</th>
                <th className="px-5 py-3">Region</th>
                <th className="px-5 py-3">Vehicle Type</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Price / Person</th>
                <th className="px-5 py-3">Tag</th>
                <th className="px-5 py-3">Stops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {packages.map((p) => (
                <Fragment key={p.id}>
                  <tr className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{p.name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{regionName(p.regionId)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{vehicleTypeTitle(p.vehicleTypeId)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{p.durationDays} days</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      ₹{p.pricePerPerson.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tagStyles[p.tag]}`}
                      >
                        {p.tag}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => setExpandedId((id) => (id === p.id ? null : p.id))}
                        className="flex items-center gap-1.5 text-sm font-medium text-primary-900 hover:underline"
                      >
                        {p.stops.length} stop{p.stops.length === 1 ? "" : "s"}
                        <Icon
                          name="chevron-down"
                          className={`h-3.5 w-3.5 transition-transform ${expandedId === p.id ? "rotate-180" : ""}`}
                        />
                      </button>
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={7} className="px-5 py-4">
                        {p.stops.length > 0 && (
                          <ol className="mb-3 flex flex-col gap-1.5">
                            {p.stops.map((stop, i) => (
                              <li
                                key={`${stop.touristSpotId}-${i}`}
                                className="flex items-center gap-2 text-sm text-slate-700"
                              >
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800">
                                  {stop.stopOrder}
                                </span>
                                {spotName(stop.touristSpotId)}
                                <span className="text-slate-400">
                                  · {stop.nightsHere} night{stop.nightsHere === 1 ? "" : "s"}
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                        <form onSubmit={handleAddStop(p.id)} className="flex flex-wrap items-end gap-3">
                          <div className="w-56">
                            <label className="mb-1 block text-xs font-semibold text-slate-600">
                              Add Tourist Spot
                            </label>
                            <select
                              required
                              value={stopForm.touristSpotId}
                              onChange={(e) => setStopForm({ ...stopForm, touristSpotId: e.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                            >
                              <option value="" disabled>Select spot</option>
                              {mockTouristSpots.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-28">
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Nights</label>
                            <input
                              type="number"
                              min={1}
                              value={stopForm.nightsHere}
                              onChange={(e) => setStopForm({ ...stopForm, nightsHere: e.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:border-primary-500 focus:outline-none"
                            />
                          </div>
                          <Button type="submit" variant="outline" size="sm">Add Stop</Button>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        This is a UI preview — changes here aren&apos;t saved yet.
      </p>
    </div>
  );
}
