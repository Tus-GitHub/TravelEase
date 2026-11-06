"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminDialog from "@/components/admin/AdminDialog";
import ActionDialog from "@/components/common/ActionDialog";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import { CMS_TYPES, CMS_MAX_SECTIONS, cmsDefinition, cmsPath, newCmsSection, type CmsDocument, type CmsSection, type CmsSectionType } from "@/lib/cms";
import type { CmsPage, CmsRevision } from "@/lib/server/cms";
import CmsFields, { CmsImageField, cmsInput } from "./CmsFields";

type DialogAction = { kind: "publish" | "unpublish" | "delete" | "restore" | "remove-section" | "reload" | "leave"; revision?: CmsRevision; section?: CmsSection; href?: string };
type Tab = "content" | "settings" | "history";
export default function CmsEditor({ initialPage, initialRevisions }: { initialPage: CmsPage; initialRevisions: CmsRevision[] }) {
  const router = useRouter();
  const [page, setPage] = useState(initialPage), [draft, setDraft] = useState<CmsDocument>(initialPage.draft), [title, setTitle] = useState(initialPage.title);
  const [revisions, setRevisions] = useState(initialRevisions), [tab, setTab] = useState<Tab>("content"), [selected, setSelected] = useState<string | undefined>(initialPage.draft.sections[0]?.id);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [addOpen, setAddOpen] = useState(false), [confirm, setConfirm] = useState<DialogAction | null>(null);
  const [preview, setPreview] = useState(false), [mobilePreview, setMobilePreview] = useState(false), [dragged, setDragged] = useState<string | null>(null);
  const dirty = title !== page.title || JSON.stringify(draft) !== JSON.stringify(page.draft);
  const section = draft.sections.find(section => section.id === selected);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      event.preventDefault(); event.stopPropagation();
      setConfirm({ kind: "leave", href: url.pathname + url.search + url.hash });
    };
    window.addEventListener("beforeunload", warn); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  function accept(item: CmsPage, history?: CmsRevision[]) {
    setPage(item); setDraft(item.draft); setTitle(item.title);
    if (history) setRevisions(history);
    setSelected(current => item.draft.sections.some(section => section.id === current) ? current : item.draft.sections[0]?.id);
  }
  async function request(body?: object) {
    const response = await fetch(`/api/admin/cms/pages/${page.id}`, body ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to save this page.");
    return data as { item: CmsPage | null; revisions: CmsRevision[] };
  }
  async function execute(action: "save" | "preview" | "publish" | "unpublish" | "delete" | "restore" | "reload", revisionId?: string) {
    if (busy) return { ok: false, error: "Please wait for the current action." };
    setBusy(true); setError(""); setNotice("");
    try {
      let current = page;
      if (dirty && ["save", "preview", "publish"].includes(action)) {
        const data = await request({ action: "save", title, draft, version: current.version });
        current = data.item!; accept(current, data.revisions);
      }
      if (action === "preview") setPreview(true);
      else if (action === "reload") { const data = await request(); accept(data.item!, data.revisions); }
      else if (action !== "save") {
        const data = await request({ action, version: current.version, revisionId });
        if (!data.item) { router.push("/admin/pages"); return { ok: true }; }
        accept(data.item, data.revisions);
      }
      setNotice(action === "publish" ? "Page published. Your changes are now visible on the website." : action === "unpublish" ? "Page unpublished. Your content remains in the editor." : action === "restore" ? "Revision restored to your draft. Preview it before publishing." : action === "reload" ? "Latest saved version loaded." : "Draft saved. Your published page is unchanged.");
      return { ok: true };
    } catch (e) { const message = e instanceof Error ? e.message : "Couldn't reach the server. Please try again."; setError(message); return { ok: false, error: message }; }
    finally { setBusy(false); }
  }
  async function upload(sectionId: string, target: string, file: File) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData(); form.set("file", file); form.set("sectionId", sectionId); form.set("target", target); form.set("version", String(page.version)); form.set("title", title); form.set("document", JSON.stringify(draft));
      const response = await fetch(`/api/admin/cms/pages/${page.id}/image`, { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to upload image.");
      accept(data.item); setNotice("Image uploaded and draft saved. Publish when you are ready.");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload the image. Try again."); }
    finally { setBusy(false); }
  }
  function updateSection(id: string, update: (section: CmsSection) => CmsSection) {
    setDraft(current => ({ ...current, sections: current.sections.map(section => section.id === id ? update(section) : section) })); setNotice("");
  }
  function move(id: string, target: number) {
    if (busy || target < 0 || target >= draft.sections.length) return;
    setDraft(current => { const next = [...current.sections], from = next.findIndex(section => section.id === id); if (from < 0) return current; const [section] = next.splice(from, 1); next.splice(target, 0, section); return { ...current, sections: next }; });
    setNotice("");
  }
  function add(type: CmsSectionType) {
    if (busy || draft.sections.length >= CMS_MAX_SECTIONS) return;
    const section = newCmsSection(type); setDraft(current => ({ ...current, sections: [...current.sections, section] })); setSelected(section.id); setAddOpen(false); setTab("content"); setNotice("");
  }
  const previewUrl = `/cms-preview/${page.id}?v=${page.version}`;
  const confirmations: Record<DialogAction["kind"], { title: string; description: string; label: string }> = {
    publish: { title: `Publish ${title}?`, description: "Your draft will replace the version visitors see. A revision will be kept so you can restore it later.", label: "Publish page" },
    unpublish: { title: "Unpublish this page?", description: "Visitors will no longer be able to open this page. Saved content and revisions stay in the editor.", label: "Unpublish page" },
    delete: { title: "Remove this page?", description: "This removes the page from the website and page list. Its published revisions are retained.", label: "Remove page" },
    restore: { title: "Restore this revision?", description: "This replaces the current draft, including any unsaved edits. Your published page stays unchanged until you publish again.", label: "Restore to draft" },
    "remove-section": { title: "Remove this section?", description: "It will be removed from your draft. The published page stays unchanged until you publish.", label: "Remove section" },
    reload: { title: "Load the latest saved page?", description: "This discards unsaved changes in this editor and loads the latest saved draft.", label: "Reload page" },
    leave: { title: "Leave without saving?", description: "Your unsaved changes will be discarded. Save your draft first if you want to keep them.", label: "Leave editor" },
  };
  return <div className="mx-auto max-w-[1600px]">
    <button type="button" disabled={busy} onClick={() => dirty ? setConfirm({ kind: "leave" }) : router.push("/admin/pages")} className="mb-5 text-sm font-semibold text-muted hover:text-accent-600">← All pages</button>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-5"><div><div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-3xl font-bold text-fg">{title || "Untitled page"}</h1><span className={`rounded-full px-3 py-1 text-xs font-semibold ${page.status === "published" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{page.status === "published" ? "Published" : "Draft"}</span></div><p className="mt-2 text-xs text-muted">{cmsPath(page.slug)} <span className="mx-2">·</span> {dirty ? "Unsaved changes" : page.hasChanges ? "Saved draft has unpublished changes" : "Everything is up to date"}</p></div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} iconLeft="eye" onClick={() => void execute("preview")}>Preview</Button><Button type="button" variant="outline" disabled={busy || !dirty} onClick={() => void execute("save")}>Save draft</Button><Button type="button" variant="accent" disabled={busy} onClick={() => setConfirm({ kind: "publish" })}>{busy ? "Working…" : "Publish"}</Button></div>
    </div>
    {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-500/10 dark:text-red-300"><p>{error}</p><button type="button" disabled={busy} onClick={() => setConfirm({ kind: "reload" })} className="font-bold underline">Reload saved page</button></div>}
    {notice && <p role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>}
    <div className="mb-6 flex gap-1 border-b border-line" role="tablist" aria-label="Page editor" onKeyDown={e => { if (busy || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault(); const tabs: Tab[] = ["content", "settings", "history"]; const index = tabs.indexOf(tab); const next = tabs[e.key === "Home" ? 0 : e.key === "End" ? 2 : (index + (e.key === "ArrowRight" ? 1 : 2)) % 3]; setTab(next); e.currentTarget.querySelector<HTMLButtonElement>(`#cms-tab-${next}`)?.focus(); }}>{(["content", "settings", "history"] as const).map(value => <button key={value} role="tab" id={`cms-tab-${value}`} aria-controls="cms-panel" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} type="button" disabled={busy} onClick={() => setTab(value)} className={`border-b-2 px-5 py-3 text-sm font-semibold ${tab === value ? "border-accent-500 text-fg" : "border-transparent text-muted hover:text-fg"}`}>{value === "content" ? "Sections" : value === "settings" ? "Page settings" : "Revision history"}</button>)}</div>
    <div role="tabpanel" id="cms-panel" aria-labelledby={`cms-tab-${tab}`}>
      {tab === "content" && <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-3xl border border-line bg-surface p-4 xl:sticky xl:top-5"><div className="mb-4 flex items-center justify-between px-1"><h2 className="text-sm font-bold">Page sections</h2><span className="text-xs text-muted">{draft.sections.length}/{CMS_MAX_SECTIONS}</span></div><p className="mb-4 px-1 text-xs leading-relaxed text-muted">Drag to reorder, or use the arrows. Select a section to edit its content.</p>
          <ol className="space-y-2">{draft.sections.map((item, index) => <li key={item.id} draggable={!busy} onDragStart={e => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; setDragged(item.id); }} onDragEnd={() => setDragged(null)} onDragOver={e => { if (dragged) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (dragged) move(dragged, index); setDragged(null); }} className={`rounded-2xl border p-3 transition ${selected === item.id ? "border-accent-500 bg-accent-500/5" : "border-line bg-surface"} ${dragged === item.id ? "opacity-50" : ""}`}>
            <button type="button" disabled={busy} onClick={() => setSelected(item.id)} aria-label={`Edit ${cmsDefinition(item.type).label}`} aria-pressed={selected === item.id} className="flex w-full items-center gap-3 text-left"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-xs font-bold text-muted">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-fg">{cmsDefinition(item.type).label}</span><span className="mt-0.5 block truncate text-[11px] text-muted">{typeof item.content.title === "string" ? item.content.title : item.visible ? "Visible on page" : "Hidden"}</span></span></button>
            <div className="mt-2 flex justify-end gap-1"><button type="button" disabled={busy || index === 0} aria-label={`Move ${cmsDefinition(item.type).label} up`} onClick={() => move(item.id, index - 1)} className="rounded-md px-2 py-1 text-muted hover:bg-surface-muted disabled:opacity-25">↑</button><button type="button" disabled={busy || index === draft.sections.length - 1} aria-label={`Move ${cmsDefinition(item.type).label} down`} onClick={() => move(item.id, index + 1)} className="rounded-md px-2 py-1 text-muted hover:bg-surface-muted disabled:opacity-25">↓</button><button type="button" disabled={busy} aria-label={`${item.visible ? "Hide" : "Show"} ${cmsDefinition(item.type).label}`} onClick={() => updateSection(item.id, section => ({ ...section, visible: !section.visible }))} className={`rounded-md px-2 py-1 ${item.visible ? "text-muted hover:bg-surface-muted" : "bg-amber-500/10 text-amber-600"}`}><Icon name={item.visible ? "eye" : "eye-off"} className="h-4 w-4" /></button></div>
          </li>)}</ol><Button type="button" variant="outline" fullWidth size="sm" className="mt-4" disabled={busy || draft.sections.length >= CMS_MAX_SECTIONS} onClick={() => setAddOpen(true)}>+ Add section</Button>
        </aside>
        {section && <section className="min-w-0 overflow-hidden rounded-3xl border border-line bg-surface" aria-label="Section settings"><header className="border-b border-line bg-surface-muted/50 px-5 py-5 sm:px-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-600">Section editor</p><h2 className="mt-2 font-display text-xl font-bold">{cmsDefinition(section.type).label}</h2><p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">{cmsDefinition(section.type).description}</p></div><div className="flex gap-1">{cmsDefinition(section.type).repeatable && <Button type="button" variant="ghost" size="sm" disabled={busy || draft.sections.length >= CMS_MAX_SECTIONS} onClick={() => { const copy = { ...structuredClone(section), id: crypto.randomUUID() }; setDraft(current => ({ ...current, sections: [...current.sections, copy] })); setSelected(copy.id); }}>Duplicate</Button>}<Button type="button" variant="ghost" size="sm" iconLeft="trash" disabled={busy || draft.sections.length === 1} onClick={() => setConfirm({ kind: "remove-section", section })}>Remove</Button></div></div></header>
          <fieldset disabled={busy} className="min-w-0 space-y-8 p-5 sm:p-7"><CmsFields key={section.id} fields={cmsDefinition(section.type).fields} value={section.content} prefix={section.id} disabled={busy} onChange={content => updateSection(section.id, current => ({ ...current, content }))} onUpload={(target, file) => upload(section.id, target, file)} />
            {section.type !== "travel-band" && <div className="space-y-5 border-t border-line pt-6"><div><h3 className="text-sm font-bold">Section appearance</h3><p className="mt-1 text-xs text-muted">Choose a background that fits your story.</p></div><label className="block text-sm font-semibold">Background<select aria-label="Background" className={cmsInput} value={section.appearance.background} onChange={e => updateSection(section.id, s => ({ ...s, appearance: { ...s.appearance, background: e.target.value as CmsSection["appearance"]["background"] } }))}><option value="default">Original section style</option><option value="light">Theme canvas</option><option value="muted">Theme soft background</option><option value="dark">Deep navy</option><option value="image">Background photograph</option></select></label>
              {section.appearance.background === "image" && <><CmsImageField id={`${section.id}-background`} label="Background image" value={section.appearance.imageUrl} disabled={busy} onChange={imageUrl => updateSection(section.id, s => ({ ...s, appearance: { ...s.appearance, imageUrl } }))} onUpload={file => upload(section.id, "background", file)} /><label className="block text-sm font-semibold">Dark overlay · {section.appearance.overlay}%<input aria-label="Background dark overlay" type="range" min={0} max={90} step={5} className="mt-3 w-full accent-accent-500" value={section.appearance.overlay} onChange={e => updateSection(section.id, s => ({ ...s, appearance: { ...s.appearance, overlay: Number(e.target.value) } }))} /></label></>}
            </div>}
          </fieldset>
        </section>}
      </div>}
      {tab === "settings" && <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2"><div className="space-y-5 rounded-3xl border border-line bg-surface p-6"><h2 className="font-display text-xl font-bold">Page & search appearance</h2><label className="block text-sm font-semibold">Page name<input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} className={cmsInput} /></label><p className="text-xs text-muted">Page address: {cmsPath(page.slug)}</p><label className="block text-sm font-semibold">SEO title<input value={draft.seo.title} maxLength={200} className={cmsInput} onChange={e => setDraft(d => ({ ...d, seo: { ...d.seo, title: e.target.value } }))} /></label><label className="block text-sm font-semibold">SEO description<textarea aria-label="SEO description" rows={4} value={draft.seo.description} maxLength={500} className={cmsInput} onChange={e => setDraft(d => ({ ...d, seo: { ...d.seo, description: e.target.value } }))} /></label></div>
        <div className="space-y-5 rounded-3xl border border-line bg-surface p-6"><h2 className="font-display text-xl font-bold">Website navigation</h2><p className="text-xs leading-relaxed text-muted">Menu changes become visible when you publish this page.</p>{(["header", "footer"] as const).map(key => <label key={key} className="flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold"><input type="checkbox" checked={draft.navigation[key]} className="accent-accent-500" onChange={e => setDraft(d => ({ ...d, navigation: { ...d.navigation, [key]: e.target.checked } }))} />Show in {key === "header" ? "main menu" : "footer"}</label>)}<label className="block text-sm font-semibold">Menu label<input className={cmsInput} maxLength={80} value={draft.navigation.label} onChange={e => setDraft(d => ({ ...d, navigation: { ...d.navigation, label: e.target.value } }))} /></label><label className="block text-sm font-semibold">Menu order<input type="number" min={0} max={1000} className={cmsInput} value={draft.navigation.order} onChange={e => setDraft(d => ({ ...d, navigation: { ...d.navigation, order: Number(e.target.value) } }))} /></label><p className="text-xs text-muted">Lower numbers appear first.</p></div>
        {page.slug !== "home" && <div className="flex flex-wrap gap-3 lg:col-span-2">{page.status === "published" && <Button type="button" variant="outline" onClick={() => setConfirm({ kind: "unpublish" })}>Unpublish page</Button>}{page.slug !== "about" && <Button type="button" variant="danger" iconLeft="trash" onClick={() => setConfirm({ kind: "delete" })}>Remove page</Button>}</div>}
      </fieldset>}
      {tab === "history" && <div className="rounded-3xl border border-line bg-surface p-6"><h2 className="font-display text-xl font-bold">Published revisions</h2><p className="mt-2 text-sm text-muted">Restore an earlier version into your draft. Your published page changes only when you publish again.</p><div className="mt-6 divide-y divide-line">{revisions.length ? revisions.map(revision => <div key={revision.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-bold">Version {revision.version}</p><p className="mt-1 text-xs text-muted">{new Date(revision.createdAt).toLocaleString("en-IN")}</p></div><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({ kind: "restore", revision })}>Restore to draft</Button></div>) : <p className="py-6 text-sm text-muted">Your first publication will appear here.</p>}</div></div>}
    </div>
    {addOpen && <AdminDialog title="Add a section" description="Choose a layout, then make it your own." onClose={() => setAddOpen(false)}><div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">{CMS_TYPES.map(type => { const definition = cmsDefinition(type), exists = !definition.repeatable && draft.sections.some(section => section.type === type); return <button key={type} type="button" disabled={exists} onClick={() => add(type)} className="rounded-2xl border border-line p-5 text-left transition hover:border-accent-500 hover:bg-accent-500/5 disabled:cursor-not-allowed disabled:opacity-40"><span className="font-display text-base font-bold">{definition.label}</span><span className="mt-2 block text-xs leading-relaxed text-muted">{exists ? "Already on this page" : definition.description}</span></button>; })}</div></AdminDialog>}
    {preview && <AdminDialog wide title="Preview your page" description="This is your saved draft. Visitors still see the published version." onClose={() => setPreview(false)}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div className="flex gap-2"><Button size="sm" variant={mobilePreview ? "outline" : "primary"} onClick={() => setMobilePreview(false)}>Desktop</Button><Button size="sm" variant={mobilePreview ? "primary" : "outline"} onClick={() => setMobilePreview(true)}>Mobile</Button></div><Link href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent-600">Open full preview ↗</Link></div><div className="overflow-x-auto bg-surface-muted p-3"><iframe title="Page draft preview" src={previewUrl} className={`mx-auto h-[60dvh] min-h-80 rounded-xl border border-line bg-canvas ${mobilePreview ? "w-[375px] max-w-full" : "w-full"}`} /></div></AdminDialog>}
    {confirm && <ActionDialog title={confirmations[confirm.kind].title} description={confirmations[confirm.kind].description} confirmLabel={confirmations[confirm.kind].label} danger={["delete", "unpublish", "remove-section"].includes(confirm.kind)} onClose={() => setConfirm(null)} onConfirm={async () => {
      if (confirm.kind === "leave") { router.push(confirm.href || "/admin/pages"); return; }
      if (confirm.kind === "remove-section") { setDraft(d => ({ ...d, sections: d.sections.filter(section => section.id !== confirm.section?.id) })); setSelected(draft.sections.find(section => section.id !== confirm.section?.id)?.id); return; }
      return execute(confirm.kind, confirm.revision?.id);
    }} />}
  </div>;
}
