"use client";
import { useId, useState } from "react";
import AdminDialog from "./AdminDialog";
import Button from "@/components/common/Button";

export interface ActionField {
  name: string; label: string; value?: string; required?: boolean;
  options?: { value: string; label: string }[];
}
export default function AdminActionDialog({ title, description, fields = [], confirmLabel = "Save changes", danger = false, onConfirm, onClose }: {
  title: string; description: string; fields?: ActionField[]; confirmLabel?: string; danger?: boolean;
  onConfirm: (values: Record<string, string>) => Promise<{ ok: boolean; error?: string } | void>;
  onClose: () => void;
}) {
  const fieldId = useId();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.name, f.value ?? ""])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <AdminDialog compact title={title} description={description} onClose={onClose} busy={busy}>
    <form className="space-y-5 p-6" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      try {
        const result = await onConfirm(values);
        if (result && !result.ok) setError(result.error || "Unable to save. Please try again.");
        else onClose();
      } catch { setError("Couldn't reach the server. Please try again."); }
      finally { setBusy(false); }
    }}>
      <fieldset disabled={busy} className="space-y-4">
        {fields.map(f => <label key={f.name} className="block text-sm font-semibold text-fg">
          <span id={`${fieldId}-${f.name}`}>{f.label}</span>
          {f.options ? <select aria-labelledby={`${fieldId}-${f.name}`} className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm" value={values[f.name]} onChange={e => setValues({ ...values, [f.name]: e.target.value })} required={f.required}>
            {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select> : <input aria-labelledby={`${fieldId}-${f.name}`} className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm" value={values[f.name]} onChange={e => setValues({ ...values, [f.name]: e.target.value })} required={f.required} />}
        </label>)}
      </fieldset>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button type="submit" variant={danger ? "danger" : "accent"} loading={busy}>{confirmLabel}</Button>
      </div>
    </form>
  </AdminDialog>;
}
