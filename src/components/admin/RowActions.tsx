"use client";

import { useState } from "react";

/** Edit + Delete buttons for an admin table row. Delete asks once inline. */
export default function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => Promise<{ ok: boolean; error?: string }> | void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onDelete();
            setBusy(false);
            setConfirming(false);
          }}
          className="font-semibold text-red-600 hover:underline disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-faint hover:text-muted"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3 text-xs font-medium">
      <button type="button" onClick={onEdit} className="text-primary-700 hover:underline">
        Edit
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-faint hover:text-red-600"
      >
        Delete
      </button>
    </span>
  );
}
