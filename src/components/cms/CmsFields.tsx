"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import ActionDialog from "@/components/common/ActionDialog";
import { cmsSafeImage, type CmsContent, type CmsField, type CmsItem } from "@/lib/cms";
import { MAX_IMAGE_BYTES } from "@/lib/image-upload";

export const cmsInput = "mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm font-normal text-fg outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/15 disabled:opacity-60";
export function CmsImageField({ label, value, onChange, onUpload, disabled = false, id }: {
  label: string; value: string; onChange: (url: string) => void; onUpload: (file: File) => Promise<void>; disabled?: boolean; id: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  async function choose(file?: File) {
    if (!file || disabled) return;
    if (!file.size || file.size > MAX_IMAGE_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG or WebP image up to 3 MB."); return; }
    setError(""); await onUpload(file);
  }
  return <div>
    <label htmlFor={id} className="text-sm font-semibold text-fg">{label}</label>
    <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void choose(e.dataTransfer.files[0]); }} className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface-muted/50">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl border border-line bg-surface sm:w-36">
          {value && cmsSafeImage(value) ? <Image src={value} alt={`${label} preview`} fill sizes="144px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-faint"><Icon name="image" className="h-8 w-8" /></div>}
        </div>
        <div className="min-w-0"><p className="text-sm font-semibold text-fg">Choose a photo that tells your story</p><p className="mt-1 text-xs leading-relaxed text-muted">Drop a JPG, PNG or WebP here. Up to 3 MB.</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" iconLeft="upload" type="button" disabled={disabled} onClick={() => input.current?.click()}>{value ? "Replace image" : "Upload image"}</Button>{value && <Button size="sm" variant="ghost" type="button" disabled={disabled} onClick={() => onChange("")}>Clear</Button>}</div></div>
      </div>
      <div className="border-t border-line px-4 pb-4"><input id={id} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={cmsInput} maxLength={1000} placeholder="Or paste a Cloudinary / Unsplash image URL" /><p className="mt-2 text-[11px] text-muted">Uploading saves your current draft. Publish when you are ready.</p></div>
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label={`Upload ${label}`} disabled={disabled} onChange={e => { void choose(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
  </div>;
}

export default function CmsFields({ fields, value, onChange, onUpload, prefix, disabled = false }: {
  fields: CmsField[]; value: CmsContent; onChange: (value: CmsContent) => void;
  onUpload: (target: string, file: File) => Promise<void>; prefix: string; disabled?: boolean;
}) {
  const [remove, setRemove] = useState<{ key: string; index: number } | null>(null);
  const set = (key: string, next: CmsContent[string]) => onChange({ ...value, [key]: next });
  function move(key: string, index: number, delta: number) {
    const next = [...value[key] as CmsItem[]]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; set(key, next);
  }
  return <div className="space-y-6">
    {fields.map(field => {
      const id = `${prefix}-${field.key}`, current = value[field.key];
      if (field.type === "image") return <CmsImageField key={id} id={id} label={field.label} value={String(current ?? "")} disabled={disabled} onChange={next => set(field.key, next)} onUpload={file => onUpload(field.key, file)} />;
      if (field.type === "checkbox") return <label key={id} className="flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-accent-500" checked={current === true} disabled={disabled} onChange={e => set(field.key, e.target.checked)} />{field.label}</label>;
      if (field.type === "items") {
        const entries = Array.isArray(current) ? current : [];
        return <div key={id} className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-fg">{field.label}</h3><span className="text-xs text-muted">{entries.length} / {field.max ?? 20}</span></div>
          {entries.map((entry, index) => <details key={index} className="group rounded-2xl border border-line bg-surface-muted/40" open={entries.length === 1 || undefined}>
            <summary className="cursor-pointer px-4 py-4 text-sm font-semibold text-fg"><span className="mr-2 text-faint">{String(index + 1).padStart(2, "0")}</span>{entry.title || entry.label || entry.question || `Item ${index + 1}`}</summary>
            <div className="space-y-4 border-t border-line p-4"><div className="flex justify-end gap-2">
              <button type="button" aria-label={`Move item ${index + 1} up`} disabled={disabled || index === 0} onClick={() => move(field.key, index, -1)} className="rounded-lg border border-line px-3 py-1 text-sm disabled:opacity-30">↑</button>
              <button type="button" aria-label={`Move item ${index + 1} down`} disabled={disabled || index === entries.length - 1} onClick={() => move(field.key, index, 1)} className="rounded-lg border border-line px-3 py-1 text-sm disabled:opacity-30">↓</button>
              <Button type="button" size="sm" variant="ghost" iconLeft="trash" disabled={disabled} onClick={() => setRemove({ key: field.key, index })}>Remove</Button>
            </div><CmsFields fields={field.fields ?? []} value={entry} prefix={`${id}-${index}`} disabled={disabled} onChange={next => set(field.key, entries.map((row, i) => i === index ? next as CmsItem : row))} onUpload={(target, file) => onUpload(`${field.key}.${index}.${target}`, file)} /></div>
          </details>)}
          <Button type="button" size="sm" variant="outline" disabled={disabled || entries.length >= (field.max ?? 20)} onClick={() => set(field.key, [...entries, Object.fromEntries((field.fields ?? []).map(f => [f.key, f.type === "select" ? f.options?.[0] ?? "" : ""]))])}>+ Add item</Button>
        </div>;
      }
      return <label key={id} htmlFor={id} className="block text-sm font-semibold text-fg">{field.label}
        {field.type === "textarea" ? <textarea id={id} aria-label={field.label} value={String(current ?? "")} rows={field.key === "body" ? 7 : 3} maxLength={field.max} disabled={disabled} className={cmsInput + " resize-y"} onChange={e => set(field.key, e.target.value)} />
          : field.type === "select" ? <select id={id} aria-label={field.label} value={String(current ?? "")} disabled={disabled} className={cmsInput} onChange={e => set(field.key, e.target.value)}>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select>
          : <input id={id} type={field.type === "number" ? "number" : "text"} value={String(current ?? "")} maxLength={field.max} disabled={disabled} className={cmsInput} onChange={e => set(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)} />}
      </label>;
    })}
    {remove && <ActionDialog title="Remove this item?" description="It will be removed from your draft. The published page stays unchanged until you publish." confirmLabel="Remove item" danger onClose={() => setRemove(null)} onConfirm={async () => { set(remove.key, (value[remove.key] as CmsItem[]).filter((_, index) => index !== remove.index)); }} />}
  </div>;
}
