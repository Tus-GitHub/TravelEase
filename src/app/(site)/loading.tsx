import Skeleton, { CardSkeleton } from "@/components/common/Skeleton";

/** Route-level fallback while a marketing page streams in — never a bare "Loading…". */
export default function SiteLoading() {
  return (
    <div className="section-container py-28 md:py-36">
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <Skeleton className="mx-auto h-3 w-24" />
        <Skeleton className="mx-auto h-10 w-3/4" />
        <Skeleton className="mx-auto h-4 w-1/2" />
      </div>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
