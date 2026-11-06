"use client";
import { useState, useId, isValidElement, cloneElement } from "react";
import { CmsImageField, cmsInput } from "@/components/cms/CmsFields";
export { cmsInput as tripInput };
export async function tripApi<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  let data; try { data = await response.json(); } catch { throw new Error("Unable to confirm the response. Reload the saved record before retrying."); }
  if (!response.ok) throw new Error(data.error || "Unable to save. Please try again.");
  return data;
}
export function TripField({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  const id=useId();
  const control=isValidElement<Record<string,unknown>>(children)?cloneElement(children,{'aria-labelledby':id,'aria-describedby':help?id+'-help':undefined}):children;
  return <label className="block min-w-0 text-sm font-semibold text-fg"><span id={id}>{label}</span>{control}{help && <span id={id+'-help'} className="mt-2 block text-xs font-normal leading-relaxed text-muted">{help}</span>}</label>;
}
export function TripPhoto({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (url: string) => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <div><CmsImageField id={label.replace(/\W/g, "-")} label={label} value={value} onChange={onChange} disabled={disabled || busy} onUpload={async file => {
    setBusy(true); setError("");
    try { const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/admin/weekend-trips/image", { method: "POST", body });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Upload failed.");
      onChange(data.url);
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }} />{busy && <p role="status" className="mt-2 text-xs text-muted">Uploading photo…</p>}{error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}<p className="mt-2 text-xs text-muted">Save your changes to attach this photo to the record.</p></div>;
}
