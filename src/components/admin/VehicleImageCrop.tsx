"use client";
import { useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import Button from "@/components/common/Button";
import AdminDialog from "./AdminDialog";
import { vehicleCropBox, vehicleImageSource, VEHICLE_PHOTO_RATIO, type VehicleCrop } from "@/lib/vehicle-image";
import type { AdminImage } from "@/lib/image-upload";

export default function VehicleImageCrop({ image, name, onClose, onSave }: {
  image: AdminImage; name: string; onClose: () => void;
  onSave: (crop: VehicleCrop | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const source = vehicleImageSource(image.url)!;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState<"full" | "crop">(source.crop ? "crop" : "full");
  const [position, setPosition] = useState({ zoom: 1, x: 50, y: 50 });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const box = vehicleCropBox(size.width, size.height, position.zoom, position.x, position.y);
  function loaded(width: number, height: number) {
    setSize({ width, height });
    if (source.crop) {
      const c = source.crop;
      setPosition({ zoom: Math.min(width, height * VEHICLE_PHOTO_RATIO) / c.width, x: width === c.width ? 50 : c.x * 100 / (width - c.width), y: height === c.height ? 50 : c.y * 100 / (height - c.height) });
    }
  }
  function drag(event: PointerEvent<HTMLDivElement>) {
    const start = pointer.current, rect = stage.current?.getBoundingClientRect();
    if (!start || start.id !== event.pointerId || !rect || !size.width) return;
    const left = start.left + (event.clientX - start.x) * size.width / rect.width;
    const top = start.top + (event.clientY - start.y) * size.height / rect.height;
    setPosition(p => ({ ...p, x: size.width === box.width ? 50 : Math.max(0, Math.min(100, left * 100 / (size.width - box.width))), y: size.height === box.height ? 50 : Math.max(0, Math.min(100, top * 100 / (size.height - box.height))) }));
  }
  async function save() {
    setBusy(true); setError("");
    try { const result = await onSave(mode === "full" ? null : box); if (result.ok) onClose(); else setError(result.error || "Unable to save crop."); }
    catch { setError("Unable to confirm the crop. Reload photos before retrying."); }
    finally { setBusy(false); }
  }
  return <AdminDialog title="Choose the car photo frame" description={name} onClose={onClose} busy={busy}>
    <div className="space-y-5 p-4 sm:p-6">
      <p className="text-sm leading-relaxed text-muted">Show the whole car, or select a crop. The preview below is the frame travellers will see. Your original photo stays available for future edits.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Photo framing">
        <Button type="button" size="sm" variant={mode === "full" ? "primary" : "outline"} disabled={busy} aria-pressed={mode === "full"} onClick={() => setMode("full")}>Show full photo</Button>
        <Button type="button" size="sm" variant={mode === "crop" ? "primary" : "outline"} disabled={busy} aria-pressed={mode === "crop"} onClick={() => setMode("crop")}>Crop to frame</Button>
      </div>
      <div className="grid min-w-0 gap-5 md:grid-cols-2">
        <div className="min-w-0"><h3 className="mb-2 text-sm font-semibold">Original photo</h3>
          <div ref={stage} className="relative overflow-hidden rounded-xl bg-primary-950" style={{ aspectRatio: size.width ? `${size.width}/${size.height}` : "8/5" }}>
            <Image src={source.original} alt={`${name} original`} fill unoptimized draggable={false} className="object-contain" onLoad={e => loaded(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} onError={() => setError("The original photo could not load. Close and reload photos before retrying.")} />
            {mode === "crop" && size.width > 0 && <div role="img" aria-label="Selected photo area. Drag to move, or use the position sliders." className="absolute touch-none cursor-move border-2 border-white shadow-[0_0_0_2000px_rgba(0,0,0,0.55)]" style={{ left: `${box.x * 100 / size.width}%`, top: `${box.y * 100 / size.height}%`, width: `${box.width * 100 / size.width}%`, height: `${box.height * 100 / size.height}%` }}
              onPointerDown={e => { if (busy) return; e.currentTarget.setPointerCapture(e.pointerId); pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: box.x, top: box.y }; }}
              onPointerMove={drag} onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }}>
              <div className="pointer-events-none absolute inset-x-1/3 inset-y-0 border-x border-white/40" /><div className="pointer-events-none absolute inset-x-0 inset-y-1/3 border-y border-white/40" />
            </div>}
          </div>
          {mode === "crop" && <div className="mt-4 space-y-3">
            {([['zoom', 'Zoom', 1, 5, 0.05], ['x', 'Horizontal position', 0, 100, 1], ['y', 'Vertical position', 0, 100, 1]] as const).map(([key, label, min, max, step]) => <label key={key} className="block text-xs font-semibold text-muted">{label}<input aria-label={label} type="range" min={min} max={max} step={step} value={position[key]} disabled={busy || !size.width} onChange={e => setPosition(p => ({ ...p, [key]: Number(e.target.value) }))} className="mt-2 block w-full accent-amber-500" /></label>)}
            <button type="button" disabled={busy} className="text-xs font-semibold text-accent-600 dark:text-accent-400" onClick={() => setPosition({ zoom: 1, x: 50, y: 50 })}>Reset crop</button>
          </div>}
        </div>
        <div className="min-w-0"><h3 className="mb-2 text-sm font-semibold">Traveller card preview</h3>
          <div data-testid="vehicle-crop-preview" className="relative aspect-[8/5] overflow-hidden rounded-xl bg-primary-950">
            {mode === "full" ? <Image src={source.original} alt={`${name} full photo preview`} fill unoptimized className="object-contain" /> : size.width > 0 && <Image src={source.original} alt={`${name} selected crop preview`} width={size.width} height={size.height} unoptimized className="absolute left-0 top-0 max-w-none" style={{ width: `${size.width * 100 / box.width}%`, height: "auto", transform: `translate(${-box.x * 100 / size.width}%,${-box.y * 100 / size.height}%)` }} />}
          </div><p className="mt-2 text-xs leading-relaxed text-muted">The full selected frame stays visible on vehicle cards and the main vehicle photo. No extra zoom or automatic cut-off.</p>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="button" loading={busy} disabled={busy || !size.width || !!error} onClick={() => void save()}>Save photo frame</Button></div>
    </div>
  </AdminDialog>;
}
