"use client";
import Icon from "@/components/common/Icon";
import type { IconName } from "@/types";
export default function CmsIconPicker({ label, value, options, onChange, disabled }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <fieldset><legend className="text-sm font-semibold text-fg">{label}</legend><div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">{options.map(icon => <button key={icon} type="button" disabled={disabled} aria-label={`Use ${icon.replaceAll("-", " ")} icon`} aria-pressed={icon === value} onClick={() => onChange(icon)} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${icon === value ? "border-accent-500 bg-accent-500/10 text-fg" : "border-line bg-surface text-muted hover:bg-surface-hover"}`}><Icon name={icon as IconName} className="h-5 w-5" /><span className="max-w-full truncate text-[10px]">{icon.replaceAll("-", " ")}</span></button>)}</div></fieldset>;
}
