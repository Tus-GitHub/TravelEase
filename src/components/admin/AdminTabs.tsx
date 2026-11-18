export interface AdminTabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}

/** Segmented tab switcher used by admin pages that group a few related tables. */
export default function AdminTabs<T extends string>({ tabs, active, onChange }: AdminTabsProps<T>) {
  return (
    <div className="mb-6 inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1.5">
      {tabs.map((tab) => (
        <button data-ui-action=""
          key={tab.id}
          type="button"
          aria-pressed={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            active === tab.id
              ? "border border-amber-400/35 bg-amber-400/15 text-amber-600 shadow-sm dark:text-amber-300"
              : "border border-transparent text-muted hover:text-fg"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
