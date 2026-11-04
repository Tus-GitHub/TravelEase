"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/common/Icon";

export default function AdminDialog({ title, description, children, onClose, busy = false, compact = false }: {
  title: string; description?: string; children: React.ReactNode; onClose: () => void; busy?: boolean; compact?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId(); const descriptionId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const el = ref.current; el?.showModal();
    return () => el?.close();
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(
    <dialog ref={ref} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
      onCancel={(e) => { e.preventDefault(); e.stopPropagation(); if (!busy) onClose(); }}
      className={`admin-dialog m-auto max-h-[92dvh] w-[calc(100%_-_2rem)] overflow-hidden rounded-3xl border border-line bg-surface p-0 text-left text-fg shadow-2xl ${compact ? "max-w-md" : "max-w-4xl"}`}>
      <div className="flex max-h-[92dvh] flex-col">
        <header className="relative shrink-0 overflow-hidden bg-primary-950 px-6 py-5 text-white sm:px-8 sm:py-6">
          <div aria-hidden className="absolute -right-12 -top-24 h-56 w-56 rounded-full border-[32px] border-white/5" />
          <div className="relative flex items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-accent-300">Jagdamba Travellers · Admin</p>
              <h2 id={titleId} className="break-words font-display text-xl font-semibold sm:text-2xl">{title}</h2>
              {description && <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-white/65">{description}</p>}
            </div>
            <button type="button" disabled={busy} aria-label="Close dialog" onClick={onClose} className="rounded-full border border-white/15 bg-white/5 p-2 text-white/80 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-40"><Icon name="close" className="h-5 w-5" /></button>
          </div>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </dialog>, document.body,
  );
}
