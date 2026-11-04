"use client";

import { useEffect, useState } from "react";
import ActionDialog from "@/components/common/ActionDialog";
import EditButton from "@/components/common/EditButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/account/AccountSection";
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
  const [action, setAction] = useState<{ kind: "edit" | "remove"; trip: SavedItinerary } | null>(null);
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

  const saveAction = async (values: Record<string, string>) => {
    if (!action) return { ok: false, error: "Select a trip first." };
    const removing = action.kind === "remove";
    const title = values.title?.trim();
    if (!removing && (!title || title.length > 120)) return { ok: false, error: "Use a trip name between 1 and 120 characters." };
    const res = await fetch(`/api/saved-itineraries/${action.trip.id}`, {
      method: removing ? "DELETE" : "PATCH",
      headers: removing ? undefined : { "Content-Type": "application/json" },
      body: removing ? undefined : JSON.stringify({ title }),
    });
    if (!res.ok) { const data = await res.json().catch(() => ({})); return { ok: false, error: data.error || "Could not update your saved trip." }; }
    setItems(current => current?.flatMap(trip => trip.id !== action.trip.id ? [trip] : removing ? [] : [{ ...trip, title: title! }]) ?? current);
    return { ok: true };
  };

  return (
    <Section bg="gray" eyebrow="Your account" title="Saved trips">
      {action && <ActionDialog title={action.kind === "edit" ? "Edit saved trip" : "Remove saved trip?"} description={action.kind === "edit" ? action.trip.title : `${action.trip.title} will be removed from your saved trips. Existing bookings will not change.`} danger={action.kind === "remove"} confirmLabel={action.kind === "remove" ? "Remove trip" : "Save changes"} fields={action.kind === "edit" ? [{ name: "title", label: "Trip name", value: action.trip.title, required: true }] : []} onConfirm={saveAction} onClose={() => setAction(null)} />}
      <div className="mx-auto max-w-4xl">
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
                        <EditButton name={it.title} onClick={() => setAction({ kind: "edit", trip: it })} />
                        <button
                          type="button"
                          onClick={() => setAction({ kind: "remove", trip: it })}
                          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium text-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                        >
                          <Icon name="trash" className="h-4 w-4" />Remove
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
