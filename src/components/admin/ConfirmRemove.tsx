"use client";
import { useState } from "react";
import AdminDialog from "./AdminDialog";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";

export default function ConfirmRemove({ name, description, onConfirm, onClose }: {
  name: string; description?: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string } | void> | void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function remove() {
    setBusy(true); setError("");
    try {
      const result = await onConfirm();
      if (result && !result.ok) { setError(result.error || "Unable to remove this item."); return; }
      onClose();
    } catch { setError("Unable to remove this item. Please try again."); }
    finally { setBusy(false); }
  }
  return <AdminDialog compact title="Remove this item?" description={name} onClose={onClose} busy={busy}>
    <div className="p-6">
      <div className="mb-5 flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"><Icon name="trash" className="h-5 w-5" /></div>
        <p className="text-sm leading-6 text-muted">{description || "This item will be removed from your active records. Any linked records may need to be updated first."}</p>
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-3"><Button autoFocus type="button" variant="outline" disabled={busy} onClick={onClose}>Keep item</Button><Button type="button" variant="danger" loading={busy} iconLeft="trash" onClick={() => void remove()}>Remove</Button></div>
    </div>
  </AdminDialog>;
}
