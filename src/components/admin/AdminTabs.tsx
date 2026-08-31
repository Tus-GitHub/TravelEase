export interface AdminTabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}

/** Segmented tab switcher used by admin pages that group a few related tables. */
export default function AdminTabs<T extends string>({ tabs, active, onChange }: AdminTabsProps<T>) {
  return (
    <div className="mb-6 inline-flex gap-1 rounded-xl bg-surface-hover p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            active === tab.id
              ? "bg-surface text-primary-900 shadow-sm dark:text-primary-200"
              : "text-muted hover:text-fg"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
