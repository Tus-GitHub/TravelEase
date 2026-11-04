"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Icon from "@/components/common/Icon";
import Button from "@/components/common/Button";
import AdminDialog from "./AdminDialog";
import ConfirmRemove from "./ConfirmRemove";
import { MAX_IMAGE_BYTES, type AdminImage, type ImageKind } from "@/lib/image-upload";

export default function ImageManager({ kind, id, name, onBusyChange }: {
  kind: ImageKind; id: number; name: string; onBusyChange?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<AdminImage[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AdminImage | null>(null);
  const [progress, setProgress] = useState("");
  const [dragging, setDragging] = useState(false);
  const endpoint = `/api/admin/images/${kind}/${id}`;
  const multiple = kind === "vehicles";
  const canUpload = loaded && configured && !busy && (!multiple || items.length < 10);

  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  useEffect(() => {
    const urls = selected.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [selected]);
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false); setError("");
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Unable to load photos."); return data; })
      .then((data) => { setItems(data.items); setConfigured(data.configured); setLoaded(true); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message || "Unable to load photos."); });
    return () => controller.abort();
  }, [endpoint]);

  async function send(init?: RequestInit) {
    const response = await fetch(endpoint, { ...init, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to update photos.");
    setItems(data.items); setConfigured(data.configured); setLoaded(true);
  }
  async function request(init?: RequestInit) {
    setBusy(true); setError(""); setNotice("");
    try { await send(init); setNotice(init ? "Photo changes saved." : ""); return { ok: true }; }
    catch (err) { const message = err instanceof Error ? err.message : "Unable to update photos."; setError(message); return { ok: false, error: message }; }
    finally { setBusy(false); }
  }
  function select(files: File[]) {
    if (!canUpload || !files.length) return;
    setError(""); setNotice("");
    if (files.some((file) => !file.size || file.size > MAX_IMAGE_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setError("Choose JPEG, PNG or WebP photos up to 3 MB each."); return;
    }
    const next = multiple ? [...selected, ...files] : files;
    if (next.length > (multiple ? 10 - items.length : 1)) {
      setError(multiple ? `There is room for ${10 - items.length} more photos. Remove some from your selection first.` : "Choose one driver or catalogue photo."); return;
    }
    setSelected(next);
  }
  async function upload() {
    if (!selected.length || busy) return;
    setBusy(true); setError(""); setNotice("");
    let completed = 0;
    try {
      for (const file of selected) {
        setProgress(`Uploading ${completed + 1} of ${selected.length}...`);
        const body = new FormData(); body.set("file", file);
        await send({ method: "POST", body }); completed++;
      }
      setNotice(`${completed} ${completed === 1 ? "photo" : "photos"} uploaded and saved.`);
    } catch (err) {
      setError(`${completed} uploaded. ${err instanceof Error ? err.message : "Upload failed."} Remaining photos are ready to retry.`);
    } finally { setSelected((files) => files.slice(completed)); setProgress(""); setBusy(false); }
  }
  const change = (imageId: number, action: "remove" | "primary") => request({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId, action }) });

  return <section aria-label={`Photos for ${name}`}>
    <div className="mb-5 flex items-start justify-between gap-4">
      <div><h3 className="font-display text-lg font-semibold text-fg">{multiple ? "Vehicle gallery" : kind === "drivers" ? "Profile photo" : "Cover photo"}</h3><p className="mt-1 text-sm text-muted">{multiple ? "Give travellers a clear view of their ride. Your main image appears first." : "Choose a clear, welcoming image for this profile."}</p></div>
      <span className="shrink-0 rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">{items.length} / {multiple ? 10 : 1}</span>
    </div>
    {loaded && !configured && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Image storage is not connected yet. Please ask your administrator to finish setup.</p>}
    <div onDragOver={(e) => { e.preventDefault(); if (canUpload) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); select(Array.from(e.dataTransfer.files)); }}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-8 ${dragging ? "border-accent-400 bg-accent-50 dark:bg-accent-500/10" : "border-line bg-surface-muted/50"}`}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300"><Icon name="upload" className="h-6 w-6" /></div>
      <p className="font-semibold text-fg">{multiple && items.length >= 10 ? "Your gallery is full" : "Drop your photos here"}</p>
      <p className="mb-4 mt-1 text-xs text-muted">JPG, PNG or WebP. Up to 3 MB each.</p>
      <Button type="button" variant="outline" size="sm" iconLeft="image" disabled={!canUpload} onClick={() => input.current?.click()}>{multiple ? "Browse photos" : items.length ? "Replace photo" : "Browse photo"}</Button>
      <input ref={input} className="sr-only" tabIndex={-1} aria-label="Choose photos" type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} disabled={!canUpload} onChange={(e) => { select(Array.from(e.currentTarget.files ?? [])); e.currentTarget.value = ""; }} />
    </div>
    {selected.length > 0 && <div className="mt-6">
      <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-semibold">Ready to upload <span className="ml-1 text-muted">({selected.length})</span></h4><button type="button" disabled={busy} onClick={() => setSelected([])} className="text-xs font-medium text-muted hover:text-fg disabled:opacity-50">Clear selection</button></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {selected.map((file, index) => <div key={`${file.name}-${index}`} className="relative rounded-xl border border-line bg-surface p-2">
          {previews[index] && <button type="button" className="block w-full" aria-label={`Preview ${file.name}`} onClick={() => setPreview(previews[index])}><Image src={previews[index]} alt={file.name} width={320} height={200} unoptimized className="aspect-[8/5] w-full rounded-lg object-cover" /></button>}
          <button type="button" disabled={busy} aria-label={`Remove ${file.name} from selection`} onClick={() => setSelected((files) => files.filter((_, i) => i !== index))} className="absolute right-3 top-3 rounded-full bg-primary-950/85 p-1.5 text-white shadow-sm disabled:opacity-50"><Icon name="close" className="h-3.5 w-3.5" /></button>
          <p className="mt-2 truncate text-xs text-muted">{file.name}</p>
        </div>)}
      </div>
      <div className="mt-4 flex justify-end"><Button type="button" variant="primary" loading={busy} iconLeft="upload" disabled={busy || !configured} onClick={() => void upload()}>{progress || `Upload ${selected.length} ${selected.length === 1 ? "photo" : "photos"}`}</Button></div>
    </div>}
    {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error} <button type="button" disabled={busy} onClick={() => void request()} className="ml-2 font-semibold underline">Retry loading</button></div>}
    <p role="status" className="mt-3 text-xs text-muted">{busy ? progress || "Saving photo changes..." : notice || (!loaded && !error ? "Loading photos..." : "")}</p>
    {items.length > 0 && <div className="mt-6">
      <h4 className="mb-3 text-sm font-semibold">{multiple ? "Your gallery" : "Current photo"}</h4>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => <article key={item.id} className={`overflow-hidden rounded-2xl border bg-surface ${item.primary ? "border-accent-400/70 shadow-sm" : "border-line"}`}>
          <div className="group relative"><button type="button" onClick={() => setPreview(item.url)} aria-label={`Preview ${name} photo`} className="block w-full"><Image src={item.url} alt={`${name} photo`} width={480} height={320} unoptimized className="aspect-[3/2] w-full object-cover transition group-hover:brightness-90" /><span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-primary-950/80 px-2.5 py-1 text-[11px] font-medium text-white"><Icon name="eye" className="h-3.5 w-3.5" />Preview</span></button>
            {item.primary && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent-300 px-2.5 py-1 text-[10px] font-bold text-primary-950"><Icon name="star" className="h-3 w-3" />{multiple ? "MAIN IMAGE" : "PROFILE PHOTO"}</span>}
          </div>
          <div className="flex items-center justify-between gap-2 p-3">
            {multiple && !item.primary ? <button type="button" disabled={busy} onClick={() => void change(item.id, "primary")} className="rounded-lg border border-line px-2.5 py-2 text-xs font-semibold text-fg hover:bg-surface-hover disabled:opacity-50">Set as main</button> : <span className="text-xs text-muted">Visible to travellers</span>}
            <button type="button" disabled={busy} onClick={() => setRemoving(item)} aria-label="Remove photo" className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10"><Icon name="trash" className="h-4 w-4" /></button>
          </div>
        </article>)}
      </div>
    </div>}
    <p className="mt-6 border-t border-line pt-4 text-xs leading-5 text-muted">Photo uploads and main-image changes save immediately. Use Close when you are done. Only upload public photos, not identity documents.</p>
    {preview && <AdminDialog title="Photo preview" description={name} onClose={() => setPreview(null)}><div className="bg-primary-950/5 p-3 dark:bg-black/20"><Image src={preview} alt={`${name} preview`} width={1400} height={1000} unoptimized className="max-h-[65dvh] w-full object-contain" /></div></AdminDialog>}
    {removing && <ConfirmRemove name={`${name} - photo`} description="This photo will be removed from this profile. The other photos will stay in place." onConfirm={() => change(removing.id, "remove")} onClose={() => setRemoving(null)} />}
  </section>;
}
