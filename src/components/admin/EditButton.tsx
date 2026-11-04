import Icon from "@/components/common/Icon";
export default function EditButton({ onClick, name, disabled = false }: { onClick: () => void; name: string; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} aria-label={`Edit ${name}`} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-fg shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50 dark:hover:bg-primary-950 dark:hover:text-primary-200"><Icon name="pencil" className="h-4 w-4" />Edit</button>;
}
