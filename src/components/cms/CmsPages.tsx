"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminDialog from "@/components/admin/AdminDialog";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import { cmsPath } from "@/lib/cms";
import type { CmsPageSummary } from "@/lib/server/cms";
import { cmsInput } from "./CmsFields";

export default function CmsPages() {
  const router = useRouter();
  const [pages, setPages] = useState<CmsPageSummary[] | null>(null), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(""), [slug, setSlug] = useState(""), [slugEdited, setSlugEdited] = useState(false), [template, setTemplate] = useState("blank");
  const [createError, setCreateError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/admin/cms/pages", { signal: abort.signal, cache: "no-store" }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Unable to load pages."); setPages(data.items); }).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setCreateError("");
    try {
      const response = await fetch("/api/admin/cms/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, slug, template }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to create the page.");
      router.push(`/admin/pages/${data.item.id}`);
    } catch (e) { setCreateError(e instanceof Error ? e.message : "Couldn't reach the server."); setBusy(false); }
  }
  const filtered = pages?.filter(page => `${page.title} ${page.slug}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <AdminPageHeader><div className="flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-3xl font-bold">Your website, your story</h1><p className="mt-2 max-w-2xl text-sm">Create pages and shape every section. Keep working in a draft, preview the result, then publish when it feels right.</p></div><Button variant="accent" type="button" onClick={() => { setOpen(true); setTitle(""); setSlug(""); setSlugEdited(false); setCreateError(""); }}>+ Create page</Button></div></AdminPageHeader>
    <div className="mb-6 grid gap-4 sm:grid-cols-3">{[["Pages", pages?.length ?? "—"], ["Published", pages?.filter(p => p.status === "published").length ?? "—"], ["Draft changes", pages?.filter(p => p.hasChanges).length ?? "—"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-line bg-surface p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p><p className="mt-2 font-display text-3xl font-bold text-fg">{value}</p></div>)}</div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-bold text-fg">Pages</h2><label className="w-full sm:w-72"><span className="sr-only">Search pages</span><input className={cmsInput + " !mt-0"} placeholder="Search pages…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!pages && !error && <p className="p-6 text-sm text-muted">Loading your pages…</p>}
    {filtered?.length === 0 && <div className="rounded-3xl border border-dashed border-line p-12 text-center text-muted">No pages match your search.</div>}
    <div className="grid gap-4 xl:grid-cols-2">{filtered?.map(page => <article key={page.id} className="group rounded-3xl border border-line bg-surface p-5 transition hover:border-accent-500/50 hover:shadow-md sm:p-6"><div className="flex items-start gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-950 text-accent-400"><Icon name={page.slug === "home" ? "grid" : "bookmark"} className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-display text-lg font-bold text-fg">{page.title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${page.status === "published" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{page.status}</span></div><p className="mt-1 truncate text-xs text-muted">{cmsPath(page.slug)}</p><p className="mt-3 text-xs text-muted">{page.hasChanges ? "Unpublished changes are waiting in your draft." : "Your published page is up to date."}</p></div></div><div className="mt-5 flex items-center justify-between border-t border-line pt-4"><span className="text-[11px] text-faint">Updated {new Date(page.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span><Link href={`/admin/pages/${page.id}`} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-muted px-4 py-2 text-sm font-semibold text-fg transition hover:border-accent-500 hover:text-accent-600"><Icon name="pencil" className="h-4 w-4" />Edit page<span className="sr-only"> {page.title}</span></Link></div></article>)}</div>
    {open && <AdminDialog title="Create a new page" description="Start with a blank page or reuse one of your existing layouts." busy={busy} onClose={() => setOpen(false)}><form onSubmit={create} className="space-y-5 p-6 sm:p-8">
      <label className="block text-sm font-semibold">Page name<input required maxLength={200} value={title} disabled={busy} onChange={e => { setTitle(e.target.value); if (!slugEdited) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160)); }} className={cmsInput} placeholder="For example, Our Services" /></label>
      <label className="block text-sm font-semibold">Page address<input required maxLength={160} value={slug} disabled={busy} onChange={e => { setSlug(e.target.value); setSlugEdited(true); }} className={cmsInput} placeholder="our-services" /><span className="mt-2 block text-xs font-normal text-muted">/{slug || "your-page"} · This address stays fixed after creation.</span></label>
      <label className="block text-sm font-semibold">Starting layout<select value={template} disabled={busy} onChange={e => setTemplate(e.target.value)} className={cmsInput}><option value="blank">Blank page</option><option value="about">About page layout</option><option value="home">Homepage layout</option></select></label>
      {createError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{createError}</p>}
      <div className="flex justify-end gap-3 border-t border-line pt-5"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="accent" loading={busy}>Create draft</Button></div>
    </form></AdminDialog>}
  </>;
}
