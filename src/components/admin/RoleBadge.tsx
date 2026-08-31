import type { AdminRole } from "@/lib/admin/types";

const roleStyles: Record<AdminRole, string> = {
  admin: "bg-accent-100 text-accent-700",
  agent: "bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300",
  customer: "bg-surface-hover text-muted",
};

export default function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${roleStyles[role]}`}
    >
      {role}
    </span>
  );
}
