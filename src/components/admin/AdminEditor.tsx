"use client";
import { useState } from "react";
import AdminDialog from "./AdminDialog";
import ImageManager from "./ImageManager";
import Icon from "@/components/common/Icon";
import type { ImageKind } from "@/lib/image-upload";

export default function AdminEditor({ title, onClose, busy = false, image, children }: {
  title: string; onClose: () => void; busy?: boolean; children: React.ReactNode;
  image?: { kind: ImageKind; id: number; name: string };
}) {
  const [tab, setTab] = useState<"details" | "photos">("details");
  const [uploading, setUploading] = useState(false);
  return <AdminDialog title={title} description={image ? "Manage the details and imagery your travellers see." : "Review the details, then save your changes."} busy={busy || uploading} onClose={onClose}>
    {image && <div className="flex gap-1 border-b border-line bg-surface-muted/60 px-6 pt-3 sm:px-8" aria-label="Editor sections">
      {(["details", "photos"] as const).map((value) => <button key={value} type="button" aria-pressed={tab === value} disabled={busy || uploading} onClick={() => setTab(value)} className={`inline-flex items-center gap-2 border-b-2 px-4 pb-3 pt-2 text-sm font-semibold transition disabled:opacity-50 ${tab === value ? "border-accent-500 text-fg" : "border-transparent text-muted hover:text-fg"}`}><Icon name={value === "details" ? "pencil" : "image"} className="h-4 w-4" />{value === "details" ? "Details" : "Photos"}</button>)}
    </div>}
    <div className="p-5 sm:p-8">
      <div hidden={tab !== "details"}>{children}</div>
      {image && <div hidden={tab !== "photos"}><ImageManager {...image} onBusyChange={setUploading} /></div>}
    </div>
  </AdminDialog>;
}
