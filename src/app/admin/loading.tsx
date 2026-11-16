export default function AdminLoading() {
  return <div role="status" aria-live="polite" className="space-y-5 rounded-2xl border border-line bg-surface p-6"><p className="flex items-center gap-3 text-sm font-semibold text-fg"><span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-r-transparent motion-reduce:animate-none" />Opening admin page…</p><div aria-hidden="true" className="h-8 max-w-sm rounded-xl bg-surface-muted" /><div aria-hidden="true" className="h-40 rounded-xl bg-surface-muted" /></div>;
}
