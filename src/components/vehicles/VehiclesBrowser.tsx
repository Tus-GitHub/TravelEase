"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/common/Card";
import Grid from "@/components/common/Grid";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import VehicleCard from "@/components/cards/VehicleCard";
import { vehicles } from "@/data/vehicles";

// Distinct vehicle `type` values present in the sample data.
const VEHICLE_TYPES = Array.from(new Set(vehicles.map((v) => v.type)));

// Homepage category cards / SearchForm pass a slug; map it to a real type.
const CATEGORY_TO_TYPE: Record<string, string> = {
  "tempo-traveller": "Tempo Traveller",
  "luxury-cars": "Luxury Car",
  "family-cars": "Family Car",
  "group-travel": "Group Travel",
  "airport-transfer": "", // no dedicated type in the sample fleet yet
};

const SEAT_OPTIONS = [
  { label: "Any seats", value: 0 },
  { label: "4+ seats", value: 4 },
  { label: "7+ seats", value: 7 },
  { label: "20+ seats", value: 20 },
  { label: "40+ seats", value: 40 },
];

const PRICE_OPTIONS = [
  { label: "Any price", value: 0 },
  { label: "Under ₹5,000 / day", value: 5000 },
  { label: "Under ₹7,500 / day", value: 7500 },
  { label: "Under ₹10,000 / day", value: 10000 },
  { label: "Under ₹15,000 / day", value: 15000 },
];

type Sort = "recommended" | "price-asc" | "price-desc" | "seats-desc";

const controlBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export default function VehiclesBrowser() {
  const params = useSearchParams();
  const categoryParam = params.get("category") ?? params.get("type") ?? "";
  const pickup = params.get("pickup");
  const drop = params.get("drop");
  const date = params.get("date");

  const [type, setType] = useState(CATEGORY_TO_TYPE[categoryParam] ?? "");
  const [query, setQuery] = useState("");
  const [minSeats, setMinSeats] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("recommended");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = vehicles.filter((v) => {
      if (type && v.type !== type) return false;
      if (minSeats && v.seatingCapacity < minSeats) return false;
      if (maxPrice && v.pricePerDay > maxPrice) return false;
      if (availableOnly && !v.isAvailable) return false;
      if (q && !`${v.name} ${v.type}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.pricePerDay - b.pricePerDay;
        case "price-desc":
          return b.pricePerDay - a.pricePerDay;
        case "seats-desc":
          return b.seatingCapacity - a.seatingCapacity;
        default:
          return b.rating - a.rating;
      }
    });
  }, [type, query, minSeats, maxPrice, availableOnly, sort]);

  const isFiltered = Boolean(type || query || minSeats || maxPrice || availableOnly);
  const clearAll = () => {
    setType("");
    setQuery("");
    setMinSeats(0);
    setMaxPrice(0);
    setAvailableOnly(false);
    setSort("recommended");
  };

  return (
    <div>
      {(pickup || drop || date) && (
        <p className="mb-6 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-900">
          Showing our fleet
          {pickup && (
            <>
              {" "}
              for <span className="font-semibold">{pickup}</span>
            </>
          )}
          {drop && (
            <>
              {" "}
              → <span className="font-semibold">{drop}</span>
            </>
          )}
          {date && (
            <>
              {" "}
              on <span className="font-semibold">{date}</span>
            </>
          )}
          . Live availability and trip pricing arrive with booking.
        </p>
      )}

      <Card padded hover={false} className="mb-8">
        <div className="flex flex-wrap gap-2">
          <TypeChip active={!type} onClick={() => setType("")}>
            All vehicles
          </TypeChip>
          {VEHICLE_TYPES.map((t) => (
            <TypeChip key={t} active={type === t} onClick={() => setType(t)}>
              {t}
            </TypeChip>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative block">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              placeholder="Search by name"
              aria-label="Search vehicles by name"
              onChange={(e) => setQuery(e.target.value)}
              className={`${controlBase} pl-10`}
            />
          </label>
          <select
            className={controlBase}
            value={minSeats}
            aria-label="Minimum seats"
            onChange={(e) => setMinSeats(Number(e.target.value))}
          >
            {SEAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className={controlBase}
            value={maxPrice}
            aria-label="Maximum daily price"
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          >
            {PRICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className={controlBase}
            value={sort}
            aria-label="Sort vehicles"
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="recommended">Sort: Recommended</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="seats-desc">Most seats</option>
          </select>
        </div>

        <label className="mt-3 flex w-fit items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-primary-600"
          />
          Available only
        </label>
      </Card>

      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-800">{results.length}</span>{" "}
          {results.length === 1 ? "vehicle" : "vehicles"}
        </p>
        {isFiltered && (
          <button
            type="button"
            onClick={clearAll}
            className="text-sm font-medium text-primary-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {results.length > 0 ? (
        <Grid cols={{ base: 1, sm: 2, lg: 3 }}>
          {results.map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </Grid>
      ) : (
        <Card padded hover={false} className="text-center">
          <p className="text-sm text-slate-500">No vehicles match these filters.</p>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear filters
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary-600 bg-primary-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
