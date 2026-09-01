"use client";

import { useMemo, useState } from "react";
import Card from "@/components/common/Card";
import Grid from "@/components/common/Grid";
import PackageCard from "@/components/cards/PackageCard";
import type { TravelPackage } from "@/types";

type Sort = "recommended" | "price-asc" | "price-desc" | "duration-asc";

const controlBase =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg transition-[border-color,box-shadow] duration-200 hover:border-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/60";

export default function PackagesBrowser({ packages }: { packages: TravelPackage[] }) {
  const regions = useMemo(
    () => Array.from(new Set(packages.map((p) => p.region))).sort(),
    [packages],
  );

  const [region, setRegion] = useState("");
  const [sort, setSort] = useState<Sort>("recommended");

  const results = useMemo(() => {
    const list = packages.filter((p) => !region || p.region === region);
    return list.sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.pricePerPerson - b.pricePerPerson;
        case "price-desc":
          return b.pricePerPerson - a.pricePerPerson;
        case "duration-asc":
          return a.duration - b.duration;
        default:
          return b.rating - a.rating;
      }
    });
  }, [packages, region, sort]);

  return (
    <div>
      <Card padded hover={false} className="mb-8">
        <div className="flex flex-wrap gap-2">
          <Chip active={!region} onClick={() => setRegion("")}>
            All regions
          </Chip>
          {regions.map((r) => (
            <Chip key={r} active={region === r} onClick={() => setRegion(r)}>
              {r}
            </Chip>
          ))}
        </div>
        <div className="mt-4 sm:max-w-xs">
          <select
            className={controlBase}
            value={sort}
            aria-label="Sort packages"
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="recommended">Sort: Recommended</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="duration-asc">Shortest trip</option>
          </select>
        </div>
      </Card>

      <p className="mb-5 text-sm text-muted">
        <span className="font-semibold text-fg">{results.length}</span>{" "}
        {results.length === 1 ? "package" : "packages"}
      </p>

      {results.length > 0 ? (
        <Grid cols={{ base: 1, sm: 2, lg: 3 }}>
          {results.map((p) => (
            <PackageCard key={p.id} pkg={p} />
          ))}
        </Grid>
      ) : (
        <Card padded hover={false} className="text-center">
          <p className="text-sm text-muted">No packages in this region yet.</p>
        </Card>
      )}
    </div>
  );
}

function Chip({
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
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-[transform,color,background-color,border-color] duration-150 active:scale-95 motion-reduce:active:scale-100 ${
        active
          ? "border-primary-600 bg-primary-600 text-white"
          : "border-line bg-surface text-muted hover:border-faint"
      }`}
    >
      {children}
    </button>
  );
}
