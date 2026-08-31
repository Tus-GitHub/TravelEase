"use client";

import { useState } from "react";

/**
 * Small on/off switch for admin tables. Controlled — `on` comes from the parent
 * list, which refetches after the change lands.
 *
 * Geometry: 44px track, 2px padding each side → 40px inner; 20px knob; travel
 * = 40 - 20 = 20px (translate-x-5). Insets stay an even 2px in both states.
 */
export default function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => Promise<{ ok: boolean; error?: string }> | void;
  label: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await onChange(!on);
        setBusy(false);
      }}
      className={`inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60 ${
        on ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform motion-reduce:transition-none ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
