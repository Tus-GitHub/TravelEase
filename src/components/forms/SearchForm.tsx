"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/common/Icon";
import Magnetic from "@/components/motion/Magnetic";
import { categories } from "@/data/categories";
import type { SearchFormData } from "@/types";

const today = new Date().toISOString().split("T")[0];

const field =
  "w-full rounded-xl border border-white/12 bg-white/[0.04] py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-accent-400/60 focus:bg-white/[0.07]";

/**
 * Booking console. Restyled as a "travel console" (§14) but the submit
 * behaviour is unchanged — routes to /vehicles with the criteria as query
 * params. The submit animation (§15) never delays the navigation.
 */
export default function SearchForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SearchFormData>({
    pickupLocation: "",
    dropLocation: "",
    date: "",
    vehicleType: "",
  });

  const update =
    (key: keyof SearchFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (form.pickupLocation) params.set("pickup", form.pickupLocation);
    if (form.dropLocation) params.set("drop", form.dropLocation);
    if (form.date) params.set("date", form.date);
    if (form.vehicleType) params.set("type", form.vehicleType);
    setSubmitting(true); // visual only — the navigation fires right now
    router.push(`/vehicles?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-dark rounded-3xl p-6 shadow-[0_30px_80px_-20px_rgba(2,6,20,0.7)]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
        Where are you going?
      </p>

      {/* route */}
      <div className="relative mt-4">
        <span className="pointer-events-none absolute left-[15px] top-9 bottom-9 w-px bg-white/15" />
        <span className="relative block">
          <Icon name="map-pin" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent-300" />
          <input
            type="text"
            required
            placeholder="Pickup — e.g. Mumbai Airport"
            value={form.pickupLocation}
            onChange={update("pickupLocation")}
            className={field}
          />
        </span>
        <span className="relative mt-3 block">
          <Icon name="location" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
          <input
            type="text"
            required
            placeholder="Drop — e.g. Pune Station"
            value={form.dropLocation}
            onChange={update("dropLocation")}
            className={field}
          />
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <span className="relative block">
          <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
          <input
            type="date"
            required
            min={today}
            value={form.date}
            onChange={update("date")}
            className={`${field} [color-scheme:dark]`}
          />
        </span>
        <span className="relative block">
          <Icon name="car" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
          <select
            required
            value={form.vehicleType}
            onChange={update("vehicleType")}
            className={`${field} appearance-none`}
          >
            <option value="" disabled className="bg-primary-950">
              Vehicle type
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug} className="bg-primary-950">
                {c.title}
              </option>
            ))}
          </select>
        </span>
      </div>

      <Magnetic className="mt-4 w-full" strength={0.2} radius={80}>
        <button
          type="submit"
          disabled={submitting}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-accent-500 py-3.5 text-base font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-accent-600 active:scale-[0.985] disabled:opacity-90 motion-reduce:active:scale-100"
        >
          <span
            className={`absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-700 ${
              submitting ? "w-full" : "w-0"
            }`}
          />
          <span className="relative flex items-center gap-2">
            <Icon
              name={submitting ? "arrow-right" : "search"}
              className={`h-4 w-4 ${submitting ? "animate-pulse" : ""}`}
            />
            {submitting ? "Plotting your route…" : "Plan my journey"}
          </span>
        </button>
      </Magnetic>
    </form>
  );
}
