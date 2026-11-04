"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { MAX_IMAGE_BYTES, type AdminImage, type ImageKind } from "@/lib/image-upload";

/** Images are attached to saved records, so cancelled create forms cannot leave DB rows. */
export default function ImageManager({ kind, id, name }: { kind: ImageKind; id: number; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [items, setItems] = useState<AdminImage[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/admin/images/${kind}/${id}`;
  const multiple = kind === "vehicles";

  async function request(init?: RequestInit) {
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { ...init, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update images.");
      setItems(data.items); setConfigured(data.configured); setLoaded(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update images."); }
    finally { setBusy(false); }
  }

  function open() {
    setLoaded(false); setItems([]); setError("");
    dialog.current?.showModal();
    void request();
  }

  async function upload(file?: File) {
    if (!file) return;
    if (!file.size || file.size > MAX_IMAGE_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG or WebP image up to 3 MB."); return;
    }
    const body = new FormData(); body.set("file", file);
    await request({ method: "POST", body });
  }

  function change(imageId: number, action: "remove" | "primary") {
    if (action === "remove" && !confirm("Remove this image from the record?")) return;
    void request({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId, action }) });
  }

  return (
    <>
      <button type="button" onClick={open} className="mt-1 block text-xs font-medium text-primary-600 hover:underline dark:text-primary-300">
        {multiple ? "Manage photos" : "Manage photo"}
      </button>
      <dialog ref={dialog} aria-labelledby={heading} onCancel={(e) => { if (busy) e.preventDefault(); }}
        className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface p-5 text-left text-fg shadow-2xl backdrop:bg-black/60">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div><h2 id={heading} className="text-lg font-bold">{name} — {multiple ? "photos" : "photo"}</h2>
            <p className="mt-1 text-sm font-normal text-muted">{multiple ? "Add up to 10 images. Choose a cover photo for the vehicle." : "Upload a photo to replace the current image."}</p></div>
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="rounded-lg border border-line px-3 py-1 text-sm disabled:opacity-50">Close</button>
        </div>
        <p className="mb-3 text-xs font-normal text-muted">JPEG, PNG or WebP · Maximum 3 MB · Photos are publicly accessible. Do not upload identity documents.</p>
        {loaded && !configured && <p className="mb-3 rounded-lg bg-surface-muted p-3 text-sm font-normal">Image storage isn’t connected yet. Ask the site administrator to finish setup.</p>}
        <label className="mb-4 block text-sm font-medium">{multiple ? "Add photo" : "Upload photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !loaded || !configured || (multiple && items.length >= 10)}
            className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-2 file:text-white disabled:opacity-50"
            onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void upload(file); }} />
        </label>
        {error && <div role="alert" className="mb-3 text-sm text-red-600 dark:text-red-300">{error} <button type="button" disabled={busy} onClick={() => void request()} className="underline">Reload</button></div>}
        <div aria-live="polite" className="mb-3 text-sm text-muted">{busy ? "Please wait…" : loaded && !items.length ? "No photo uploaded yet." : ""}</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item) => <div key={item.id} className="overflow-hidden rounded-xl border border-line p-2">
            <Image src={item.url} alt={`${name} photo`} width={480} height={320} unoptimized className="h-40 w-full rounded-lg object-cover" />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              {multiple && (item.primary ? <span className="font-semibold text-primary-600 dark:text-primary-300">Cover photo</span> :
                <button type="button" disabled={busy} onClick={() => change(item.id, "primary")} className="text-primary-600 hover:underline dark:text-primary-300">Set as cover</button>)}
              <button type="button" disabled={busy} onClick={() => change(item.id, "remove")} className="text-red-600 hover:underline dark:text-red-300">Remove</button>
            </div>
          </div>)}
        </div>
      </dialog>
    </>
  );
}
