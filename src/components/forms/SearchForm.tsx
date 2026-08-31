"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import FormField, { fieldBase } from "@/components/forms/FormField";
import { categories } from "@/data/categories";
import type { SearchFormData } from "@/types";

const today = new Date().toISOString().split("T")[0];

/**
 * Reusable booking search form. Used in the hero now and on the future
 * `/booking` page. On submit it routes to `/vehicles` with the criteria as
 * query params, ready for the search results page we build later.
 */
export default function SearchForm() {
  const router = useRouter();
  const [form, setForm] = useState<SearchFormData>({
    pickupLocation: "",
    dropLocation: "",
    date: "",
    vehicleType: "",
  });

  const update = (key: keyof SearchFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (form.pickupLocation) params.set("pickup", form.pickupLocation);
    if (form.dropLocation) params.set("drop", form.dropLocation);
    if (form.date) params.set("date", form.date);
    if (form.vehicleType) params.set("type", form.vehicleType);
    router.push(`/vehicles?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-canvas/95 p-5 shadow-card backdrop-blur md:grid-cols-2 lg:grid-cols-4"
    >
      <FormField label="Pickup Location" icon="map-pin">
        <input
          type="text"
          required
          placeholder="e.g. Mumbai Airport"
          value={form.pickupLocation}
          onChange={update("pickupLocation")}
          className={fieldBase}
        />
      </FormField>

      <FormField label="Drop Location" icon="location">
        <input
          type="text"
          required
          placeholder="e.g. Pune Station"
          value={form.dropLocation}
          onChange={update("dropLocation")}
          className={fieldBase}
        />
      </FormField>

      <FormField label="Travel Date" icon="calendar">
        <input
          type="date"
          required
          min={today}
          value={form.date}
          onChange={update("date")}
          className={fieldBase}
        />
      </FormField>

      <FormField label="Vehicle Type" icon="car">
        <select
          required
          value={form.vehicleType}
          onChange={update("vehicleType")}
          className={`${fieldBase} appearance-none`}
        >
          <option value="" disabled>
            Select type
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.title}
            </option>
          ))}
        </select>
      </FormField>

      <div className="md:col-span-2 lg:col-span-4">
        <Button type="submit" variant="accent" size="lg" fullWidth iconLeft="search">
          Search Vehicles
        </Button>
      </div>
    </form>
  );
}
