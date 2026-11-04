"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/common/Section";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import Badge from "@/components/common/Badge";
import Skeleton from "@/components/common/Skeleton";
import { useAuth } from "@/context/AuthContext";

interface SavedStop {
  id: number;
  name: string;
}
interface SavedItinerary {
  id: string;
  kind: "curated" | "custom";
  title: string;
  createdAt: string;
  packageSlug: string | null;
  packageName: string | null;
  regionName: string | null;
  vehicleTypeSlug: string | null;
  vehicleTypeTitle: string | null;
  stops: SavedStop[];
  available: boolean;
}

/** Rebuild the /booking/new URL this saved trip was created from. */
function bookingUrl(it: SavedItinerary): string {
  if (it.kind === "curated" && it.packageSlug) {
    return `/booking/new?package=${encodeURIComponent(it.packageSlug)}`;
  }
  const p = new URLSearchParams({ type: "package" });
  p.set("spots", it.stops.map((s) => s.id).join(","));
  if (it.vehicleTypeSlug) p.set("vehicleType", it.vehicleTypeSlug);
  if (it.regionName) p.set("regionName", it.regionName);
  return `/booking/new?${p.toString()}`;
}

export default function ProfileSavedPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<SavedItinerary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?redirect=/profile/saved");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/saved-itineraries")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setItems(d.savedItineraries))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Remove this saved trip?")) return;
    setItems((cur) => cur?.filter((i) => i.id !== id) ?? cur);
    await fetch(`/api/saved-itineraries/${id}`, { method: "DELETE" });
  };

  const rename = async (id: string, current: string) => {
    const next = prompt("Rename this saved trip", current)?.trim();
    if (!next || next === current) return;
    const res = await fetch(`/api/saved-itineraries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next }),
    });
    if (res.ok) {
      setItems((cur) =>
        cur?.map((i) => (i.id === id ? { ...i, title: next.slice(0, 120) } : i)) ?? cur,
      );
    }
  };

  return (
    <Section bg="gray" eyebrow="Your account" title="Saved trips">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/profile"
          className="hover-underline mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-300"
        >
          <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
          Back to profile
        </Link>

        {isLoading || !user || (!items && !failed) ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : failed ? (
          <Card padded hover={false} className="text-center">
            <p className="text-sm text-muted">Couldn&apos;t load your saved trips.</p>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => location.reload()}>
                Retry
              </Button>
            </div>
          </Card>
        ) : items && items.length === 0 ? (
          <Card padded hover={false} className="text-center">
            <p className="text-sm text-muted">
              You haven&apos;t saved any trips yet. Build a route or pick a package and
              hit <span className="font-medium text-fg">Save for later</span>.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Button href="/#build-package" variant="accent" size="sm">
                Build a trip
              </Button>
              <Button href="/packages" variant="outline" size="sm">
                Browse packages
              </Button>
            </div>
          </Card>
        ) : (
          <ul className="space-y-4">
            {items!.map((it) => (
              <li key={it.id}>
                <Card padded hover={false}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-bold text-fg">{it.title}</span>
                        <Badge tone={it.kind === "curated" ? "primary" : "neutral"}>
                          {it.kind === "curated" ? "Package" : "Custom route"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {it.kind === "curated"
                          ? it.packageName ?? "Curated package"
                          : `${it.regionName ? it.regionName + " · " : ""}${it.stops.length} stop${
                              it.stops.length === 1 ? "" : "s"
                            }`}
                        {it.vehicleTypeTitle ? ` · ${it.vehicleTypeTitle}` : ""}
                      </p>
                      {it.stops.length > 0 && (
                        <p className="mt-1.5 text-xs text-faint">
                          {it.stops.map((s) => s.name).join("  →  ")}
                        </p>
                      )}
                      {!it.available && (
                        <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                          {it.kind === "curated"
                            ? "This package is no longer available."
                            : "Some stops are no longer available."}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Button
                        href={it.available ? bookingUrl(it) : undefined}
                        variant="accent"
                        size="sm"
                        disabled={!it.available}
                        iconRight="arrow-right"
                      >
                        Book this trip
                      </Button>
                      <div className="flex gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => rename(it.id, it.title)}
                          className="hover-underline text-muted"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(it.id)}
                          className="hover-underline text-red-600 dark:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
