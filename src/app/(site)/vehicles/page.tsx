import { Suspense } from "react";
import type { Metadata } from "next";
import Section from "@/components/common/Section";
import VehiclesBrowser from "@/components/vehicles/VehiclesBrowser";

export const metadata: Metadata = {
  title: "Browse Vehicles — TravelEase",
  description:
    "Chauffeur-driven tempo travellers, luxury cars, family cars and coaches for every kind of trip.",
};

export default function VehiclesPage() {
  return (
    <Section
      bg="gray"
      eyebrow="Our Fleet"
      title="Browse Vehicles"
      subtitle="Chauffeur-driven vehicles for every trip — from city rides to multi-day tours."
    >
      <Suspense fallback={<p className="text-center text-sm text-muted">Loading…</p>}>
        <VehiclesBrowser />
      </Suspense>
    </Section>
  );
}
