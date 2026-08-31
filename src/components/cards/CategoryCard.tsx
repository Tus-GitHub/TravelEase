import Image from "next/image";
import Link from "next/link";
import Card from "@/components/common/Card";
import Icon from "@/components/common/Icon";
import type { VehicleCategory } from "@/types";

export interface CategoryCardProps {
  category: VehicleCategory;
}

/** Presentational card for a bookable vehicle category. */
export default function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Card className="flex flex-col">
      <div className="relative h-44 w-full overflow-hidden">
        <Image
          src={category.imageUrl}
          alt={category.title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-900/40 to-transparent" />
        <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-primary-900 shadow-sm backdrop-blur">
          <Icon name={category.icon} className="h-5 w-5" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold text-fg">
          {category.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
          {category.description}
        </p>
        <Link
          href={category.href}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 transition-colors hover:text-accent-500"
        >
          View options
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}
