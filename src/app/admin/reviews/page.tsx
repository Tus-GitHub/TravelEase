"use client";

import Card from "@/components/common/Card";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";
import { useAdminResource } from "@/lib/admin/useAdminResource";

interface Review {
  id: string;
  bookingReference: string;
  rating: number;
  title: string | null;
  body: string | null;
  isPublished: boolean;
  authorName: string;
  createdAt: string;
}

export default function AdminReviewsPage() {
  const { isLoading, allowed } = useAdminSectionGuard("reviews");
  const { items, loading, update, remove } =
    useAdminResource<Review>("/api/admin/reviews");

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Reviews</h1>
        <p className="text-sm text-muted">
          {items.length} total · {items.filter((r) => r.isPublished).length} published
        </p>
      </header>

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">By</th>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-surface-hover/60">
                  <td className="whitespace-nowrap px-4 py-3 text-accent-500">
                    {"★".repeat(r.rating)}
                    <span className="text-line">{"★".repeat(5 - r.rating)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.title && <div className="font-medium text-fg">{r.title}</div>}
                    {r.body && <div className="text-xs text-muted">{r.body}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.authorName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {r.bookingReference}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => update(r.id, { isPublished: !r.isPublished })}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.isPublished
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-surface-hover text-muted"
                      }`}
                    >
                      {r.isPublished ? "Published" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => confirm("Delete this review?") && remove(r.id)}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-faint">
                    No reviews yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
