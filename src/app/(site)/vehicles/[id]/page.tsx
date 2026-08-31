import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import StarRating from "@/components/common/StarRating";
import VehicleCard from "@/components/cards/VehicleCard";
import { vehicles } from "@/data/vehicles";

export function generateStaticParams() {
  return vehicles.map((v) => ({ id: v.id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const vehicle = vehicles.find((v) => v.id === params.id);
  return {
    title: vehicle ? `${vehicle.name} — TravelEase` : "Vehicle — TravelEase",
  };
}

export default function VehicleDetailPage({ params }: { params: { id: string } }) {
  const vehicle = vehicles.find((v) => v.id === params.id);
  if (!vehicle) notFound();

  const similar = vehicles
    .filter((v) => v.type === vehicle.type && v.id !== vehicle.id)
    .slice(0, 3);
  const priceLabel = `₹${vehicle.pricePerDay.toLocaleString("en-IN")}`;

  return (
    <Section bg="gray">
      <Link
        href="/vehicles"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
      >
        <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
        All vehicles
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-card">
          <Image
            src={vehicle.imageUrl}
            alt={vehicle.name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            priority
          />
          <span className="absolute left-4 top-4 flex gap-2">
            <Badge tone="primary">{vehicle.type}</Badge>
            <Badge tone={vehicle.isAvailable ? "success" : "neutral"}>
              {vehicle.isAvailable ? "Available" : "Booked"}
            </Badge>
          </span>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold text-fg">{vehicle.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <StarRating rating={vehicle.rating} showValue />
            <span className="text-sm text-muted">{vehicle.seatingCapacity} seater</span>
          </div>

          <div className="mt-5 flex items-end gap-1">
            <span className="font-display text-3xl font-bold text-primary-900 dark:text-primary-300 ">{priceLabel}</span>
            <span className="pb-1 text-sm text-muted">/ day</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {vehicle.features.map((feature) => (
              <Badge key={feature} icon="check">
                {feature}
              </Badge>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              href={`/booking/${vehicle.id}`}
              variant="accent"
              size="lg"
              iconRight="arrow-right"
            >
              Book Now
            </Button>
            <Button href="/vehicles" variant="outline" size="lg">
              Back to fleet
            </Button>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
            <Icon name="shield-check" className="h-4 w-4" />
            Chauffeur-driven. Driver allowance, fuel and tolls billed per trip type.
          </p>
        </div>
      </div>

      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-4">
        <Spec label="Type" value={vehicle.type} />
        <Spec label="Seating" value={`${vehicle.seatingCapacity} passengers`} />
        <Spec label="Daily rate" value={priceLabel} />
        <Spec label="Rating" value={`${vehicle.rating.toFixed(1)} / 5`} />
      </dl>

      {similar.length > 0 && (
        <div className="mt-14">
          <h2 className="font-display text-xl font-bold text-fg">Similar vehicles</h2>
          <div className="mt-6">
            <Grid cols={{ base: 1, sm: 2, lg: 3 }}>
              {similar.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </Grid>
          </div>
        </div>
      )}
    </Section>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}
