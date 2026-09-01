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
import Magnetic from "@/components/motion/Magnetic";
import Spotlight from "@/components/motion/Spotlight";
import {
  getPublicVehicle,
  listPublicVehicles,
  toCardVehicle,
  VEHICLE_IMAGE_FALLBACK,
} from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const vehicle = await getPublicVehicle(Number(params.id));
  return {
    title: vehicle ? `${vehicle.name} — TravelEase` : "Vehicle — TravelEase",
  };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getPublicVehicle(Number(params.id));
  if (!detail) notFound();

  const vehicle = toCardVehicle(detail);
  const gallery = detail.images.length ? detail.images : [VEHICLE_IMAGE_FALLBACK];
  const similar = (await listPublicVehicles({ typeSlug: detail.typeSlug }))
    .filter((v) => v.id !== detail.id)
    .slice(0, 3)
    .map(toCardVehicle);
  const priceLabel = `₹${vehicle.pricePerDay.toLocaleString("en-IN")}`;

  return (
    <Section bg="gray">
      <Link
        href="/vehicles"
        className="hover-underline inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-300"
      >
        <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
        All vehicles
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-hover shadow-card">
            <Spotlight className="h-full w-full">
              <Image
                src={gallery[0]}
                alt={vehicle.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </Spotlight>
            <span className="absolute left-4 top-4 flex gap-2">
              <Badge tone="primary">{vehicle.type}</Badge>
              <Badge tone={vehicle.isAvailable ? "success" : "neutral"}>
                {vehicle.isAvailable ? "Available" : "Booked"}
              </Badge>
            </span>
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {gallery.slice(0, 4).map((src, i) => (
                <div
                  key={src}
                  className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-hover"
                >
                  <Image
                    src={src}
                    alt={`${vehicle.name} photo ${i + 2}`}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-display text-display-sm text-fg">{vehicle.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <StarRating rating={vehicle.rating} showValue={vehicle.rating > 0} />
            <span className="text-sm text-muted">{vehicle.seatingCapacity} seater</span>
          </div>

          <div className="mt-5 flex items-end gap-1">
            <span className="font-display text-3xl font-bold text-primary-900 dark:text-primary-300 ">
              {priceLabel}
            </span>
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
            <Magnetic>
              <Button
                href={`/booking/new?vehicle=${vehicle.id}`}
                variant="accent"
                size="lg"
                iconRight="arrow-right"
              >
                Book Now
              </Button>
            </Magnetic>
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
        <Spec
          label="Rating"
          value={vehicle.rating > 0 ? `${vehicle.rating.toFixed(1)} / 5` : "Not yet rated"}
        />
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
