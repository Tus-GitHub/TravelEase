/** Shimmering placeholder block. Compose a few for a skeleton screen. */
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** A card-shaped skeleton matching the vehicle / package cards. */
export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line-subtle bg-surface">
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
