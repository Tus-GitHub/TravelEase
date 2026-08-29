"use client";

import { useMemo, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import FormField, { fieldBase } from "@/components/forms/FormField";
import AdminTabs from "@/components/admin/AdminTabs";
import {
  mockRegions,
  mockCities,
  mockTouristSpots,
  type AdminRegionRow,
  type AdminCityRow,
  type AdminTouristSpotRow,
} from "@/lib/admin/mockData";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";

type Tab = "regions" | "cities" | "spots";

function RegionsTab() {
  const [regions, setRegions] = useState<AdminRegionRow[]>(mockRegions);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", state: "" });

  const toggleActive = (id: string) => {
    setRegions((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.state.trim()) return;
    setRegions((prev) => [
      ...prev,
      { id: `r-${Date.now()}`, name: form.name.trim(), state: form.state.trim(), isActive: true },
    ]);
    setForm({ name: "", state: "" });
    setIsFormOpen(false);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{regions.length} regions</p>
        <Button variant="accent" size="sm" iconLeft="map-pin" onClick={() => setIsFormOpen((v) => !v)}>
          {isFormOpen ? "Cancel" : "Add Region"}
        </Button>
      </div>

      {isFormOpen && (
        <Card padded hover={false} className="mb-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name" icon="map-pin">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldBase}
                placeholder="e.g. Kerala Backwaters"
              />
            </FormField>
            <FormField label="State" icon="map-pin">
              <input
                required
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className={fieldBase}
                placeholder="e.g. Kerala"
              />
            </FormField>
            <div className="sm:col-span-2">
              <Button type="submit" variant="primary" size="sm">Save Region</Button>
            </div>
          </form>
        </Card>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">State</th>
                <th className="px-5 py-3">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regions.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{r.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{r.state}</td>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleActive(r.id)}
                      aria-pressed={r.isActive}
                      aria-label="Toggle active"
                      className={`relative h-6 w-11 rounded-full transition-colors ${r.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${r.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
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

function CitiesTab() {
  const [regions] = useState<AdminRegionRow[]>(mockRegions);
  const [cities, setCities] = useState<AdminCityRow[]>(mockCities);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", regionId: "", latitude: "", longitude: "", isPickupPoint: true, isAirport: false });

  const regionName = useMemo(() => {
    const map = new Map(regions.map((r) => [r.id, r.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [regions]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.regionId) return;
    setCities((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        regionId: form.regionId,
        name: form.name.trim(),
        latitude: Number(form.latitude) || 0,
        longitude: Number(form.longitude) || 0,
        isPickupPoint: form.isPickupPoint,
        isAirport: form.isAirport,
      },
    ]);
    setForm({ name: "", regionId: "", latitude: "", longitude: "", isPickupPoint: true, isAirport: false });
    setIsFormOpen(false);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{cities.length} cities</p>
        <Button variant="accent" size="sm" iconLeft="map-pin" onClick={() => setIsFormOpen((v) => !v)}>
          {isFormOpen ? "Cancel" : "Add City"}
        </Button>
      </div>

      {isFormOpen && (
        <Card padded hover={false} className="mb-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Name" icon="map-pin">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldBase}
                placeholder="e.g. Alleppey"
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
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Latitude" icon="map-pin">
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                className={fieldBase}
                placeholder="9.4981"
              />
            </FormField>
            <FormField label="Longitude" icon="map-pin">
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                className={fieldBase}
                placeholder="76.3388"
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isPickupPoint}
                onChange={(e) => setForm({ ...form, isPickupPoint: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 accent-primary-900"
              />
              Pickup point
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isAirport}
                onChange={(e) => setForm({ ...form, isAirport: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 accent-primary-900"
              />
              Has airport
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" variant="primary" size="sm">Save City</Button>
            </div>
          </form>
        </Card>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Region</th>
                <th className="px-5 py-3">Coordinates</th>
                <th className="px-5 py-3">Pickup</th>
                <th className="px-5 py-3">Airport</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cities.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{c.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{regionName(c.regionId)}</td>
                  <td className="px-5 py-3.5 text-slate-500">{c.latitude.toFixed(2)}, {c.longitude.toFixed(2)}</td>
                  <td className="px-5 py-3.5">
                    {c.isPickupPoint ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.isAirport ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}
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

function TouristSpotsTab() {
  const [cities] = useState<AdminCityRow[]>(mockCities);
  const [spots, setSpots] = useState<AdminTouristSpotRow[]>(mockTouristSpots);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", cityId: "", tag: "" });

  const cityName = useMemo(() => {
    const map = new Map(cities.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [cities]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.cityId) return;
    setSpots((prev) => [
      ...prev,
      {
        id: `ts-${Date.now()}`,
        cityId: form.cityId,
        name: form.name.trim(),
        tag: form.tag.trim(),
        displayOrder: prev.filter((s) => s.cityId === form.cityId).length + 1,
      },
    ]);
    setForm({ name: "", cityId: "", tag: "" });
    setIsFormOpen(false);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{spots.length} tourist spots</p>
        <Button variant="accent" size="sm" iconLeft="map-pin" onClick={() => setIsFormOpen((v) => !v)}>
          {isFormOpen ? "Cancel" : "Add Tourist Spot"}
        </Button>
      </div>

      {isFormOpen && (
        <Card padded hover={false} className="mb-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Name" icon="map-pin">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldBase}
                placeholder="e.g. Vembanad Lake"
              />
            </FormField>
            <FormField label="City" icon="map-pin">
              <select
                required
                value={form.cityId}
                onChange={(e) => setForm({ ...form, cityId: e.target.value })}
                className={`${fieldBase} appearance-none`}
              >
                <option value="" disabled>Select city</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Tag" icon="tag">
              <input
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
                className={fieldBase}
                placeholder="e.g. Lake, Heritage, Beach"
              />
            </FormField>
            <div className="sm:col-span-3">
              <Button type="submit" variant="primary" size="sm">Save Tourist Spot</Button>
            </div>
          </form>
        </Card>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">City</th>
                <th className="px-5 py-3">Tag</th>
                <th className="px-5 py-3">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {spots.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{s.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{cityName(s.cityId)}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-800">
                      {s.tag}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{s.displayOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function AdminGeographyPage() {
  const { isLoading, allowed } = useAdminSectionGuard("geography");
  const [tab, setTab] = useState<Tab>("regions");

  if (isLoading || !allowed) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Geography</h1>
        <p className="text-sm text-slate-500">
          Regions, cities and tourist spots that feed the Package Builder and search.
        </p>
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

      {tab === "regions" && <RegionsTab />}
      {tab === "cities" && <CitiesTab />}
      {tab === "spots" && <TouristSpotsTab />}

      <p className="mt-3 text-xs text-slate-400">
        This is a UI preview — changes here aren&apos;t saved yet.
      </p>
    </div>
  );
}
