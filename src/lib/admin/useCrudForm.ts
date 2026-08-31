"use client";

import { useState } from "react";
import type { MutateResult } from "./useAdminResource";

/**
 * Shared state for the "one form, create or edit" admin pattern: the form card
 * is opened either blank (create) or pre-filled from a row (edit); submit routes
 * to onCreate / onUpdate accordingly.
 */
export function useCrudForm<Draft>(opts: {
  empty: Draft;
  onCreate: (draft: Draft) => Promise<MutateResult>;
  onUpdate: (id: number, draft: Draft) => Promise<MutateResult>;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(opts.empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startCreate = () => {
    setDraft(opts.empty);
    setEditingId(null);
    setError(null);
    setOpen(true);
  };

  const startEdit = (id: number, next: Draft) => {
    setDraft(next);
    setEditingId(id);
    setError(null);
    setOpen(true);
  };

  const cancel = () => {
    setOpen(false);
    setEditingId(null);
    setError(null);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const res =
      editingId == null ? await opts.onCreate(draft) : await opts.onUpdate(editingId, draft);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setEditingId(null);
  };

  const patch = (fields: Partial<Draft>) => setDraft((d) => ({ ...d, ...fields }));

  return {
    open,
    editingId,
    draft,
    setDraft,
    patch,
    error,
    saving,
    startCreate,
    startEdit,
    cancel,
    submit,
  };
}
