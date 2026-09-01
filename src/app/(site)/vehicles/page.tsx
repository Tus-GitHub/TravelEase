import { Suspense } from "react";
import type { Metadata } from "next";
import Section from "@/components/common/Section";
import VehiclesBrowser from "@/components/vehicles/VehiclesBrowser";
import {
  listPublicVehicles,
  listPublicVehicleTypes,
  toCardVehicle,
} from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse Vehicles — Jagdamba Travellers",
  description:
    "Chauffeur-driven tempo travellers, luxury cars, family cars and coaches for every kind of trip.",
};

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const date = searchParams.date;
  const dayFilter =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? {
          availableFrom: new Date(`${date}T00:00:00`),
          availableTo: new Date(new Date(`${date}T00:00:00`).getTime() + 86_400_000),
        }
      : {};

  const [rows, types] = await Promise.all([
    listPublicVehicles(dayFilter),
    listPublicVehicleTypes(),
  ]);
  const vehicles = rows.map(toCardVehicle);

  return (
    <Section
      bg="gray"
      eyebrow="Our Fleet"
      title="Browse Vehicles"
      subtitle="Chauffeur-driven vehicles for every trip — from city rides to multi-day tours."
    >
      <Suspense fallback={<p className="text-center text-sm text-muted">Loading…</p>}>
        <VehiclesBrowser vehicles={vehicles} types={types} />
      </Suspense>
    </Section>
  );
}
