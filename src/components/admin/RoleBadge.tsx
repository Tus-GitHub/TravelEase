import type { AdminRole } from "@/lib/admin/mockData";

const roleStyles: Record<AdminRole, string> = {
  admin: "bg-accent-100 text-accent-700",
  agent: "bg-primary-100 text-primary-800",
  customer: "bg-slate-100 text-slate-600",
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
