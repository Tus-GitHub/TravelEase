import type { ReviewView } from "@/lib/server/reviews";

const d = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", { year: "numeric", month: "short" });

/** Published reviews on a vehicle / package page (chunk 2.7). Renders nothing when empty. */
export default function ReviewList({ reviews }: { reviews: ReviewView[] }) {
  if (reviews.length === 0) return null;
  const avg =
    Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;

  return (
    <div className="mt-14">
      <h2 className="font-display text-xl font-bold text-fg">
        Traveller reviews
        <span className="ml-2 text-sm font-normal text-muted">
          {avg} ★ · {reviews.length} review{reviews.length > 1 ? "s" : ""}
        </span>
      </h2>
      <ul className="mt-6 space-y-5">
        {reviews.map((r) => (
          <li key={r.id} className="border-b border-line-subtle pb-5 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-accent-500" aria-hidden>
                {"★".repeat(r.rating)}
                <span className="text-line">{"★".repeat(5 - r.rating)}</span>
              </span>
              <span className="text-sm font-semibold text-fg">{r.authorName}</span>
              <span className="text-xs text-faint">· {d(r.createdAt)}</span>
            </div>
            {r.title && <p className="mt-1 font-medium text-fg">{r.title}</p>}
            {r.body && <p className="mt-1 text-sm text-muted">{r.body}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
