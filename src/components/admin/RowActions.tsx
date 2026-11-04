"use client";
import { useState } from "react";
import Icon from "@/components/common/Icon";
import ConfirmRemove from "./ConfirmRemove";
export default function RowActions({ onEdit, onDelete, name = "this record" }: {
  onEdit: () => void; onDelete: () => Promise<{ ok: boolean; error?: string }> | void; name?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  return <>
    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
      <button type="button" onClick={onEdit} aria-label={`Edit ${name}`} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-fg shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 dark:hover:bg-primary-950 dark:hover:text-primary-200"><Icon name="pencil" className="h-4 w-4" />Edit</button>
      <button type="button" onClick={() => setConfirming(true)} aria-label={`Remove ${name}`} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"><Icon name="trash" className="h-4 w-4" />Remove</button>
    </div>
    {confirming && <ConfirmRemove name={name} onConfirm={onDelete} onClose={() => setConfirming(false)} />}
  </>;
}
