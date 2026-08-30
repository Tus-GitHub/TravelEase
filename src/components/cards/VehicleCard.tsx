import Image from "next/image";
import Link from "next/link";
import Card from "@/components/common/Card";
import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import StarRating from "@/components/common/StarRating";
import type { Vehicle } from "@/types";

export interface VehicleCardProps {
  vehicle: Vehicle;
}

/** Sample fleet card with image, specs, price and a Book Now CTA. */
export default function VehicleCard({ vehicle }: VehicleCardProps) {
  return (
    <Card className="flex flex-col">
      <Link href={`/vehicles/${vehicle.id}`} className="relative block h-48 w-full overflow-hidden">
        <Image
          src={vehicle.imageUrl}
          alt={vehicle.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3">
          <Badge tone="primary">{vehicle.type}</Badge>
        </span>
        <span className="absolute right-3 top-3">
          <Badge tone={vehicle.isAvailable ? "success" : "neutral"}>
            {vehicle.isAvailable ? "Available" : "Booked"}
          </Badge>
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            <Link href={`/vehicles/${vehicle.id}`} className="hover:text-primary-700">
              {vehicle.name}
            </Link>
          </h3>
          <StarRating rating={vehicle.rating} showValue />
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
          <Icon name="seat" className="h-4 w-4" />
          {vehicle.seatingCapacity} Seater
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {vehicle.features.map((feature) => (
            <Badge key={feature}>{feature}</Badge>
          ))}
        </div>

        <div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-4">
          <div>
            <span className="font-display text-2xl font-bold text-primary-900">
              ₹{vehicle.pricePerDay.toLocaleString("en-IN")}
            </span>
            <span className="text-sm text-slate-500"> / day</span>
          </div>
          <Button
            href={`/booking/${vehicle.id}`}
            variant="accent"
            size="sm"
            iconRight="arrow-right"
          >
            Book Now
          </Button>
        </div>
      </div>
    </Card>
  );
}
