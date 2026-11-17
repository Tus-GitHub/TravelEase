import Card from "@/components/common/Card";
import Icon from "@/components/common/Icon";
import type { IconName } from "@/types";

export interface StatCardProps {
  icon: IconName;
  label: string;
  value: string;
}

export default function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card padded hover={false} className="flex items-start gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-500 dark:text-amber-300">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-2xl font-bold tracking-tight text-fg">{value}</p>
        <p className="mt-0.5 text-sm text-muted">{label}</p>
      </div>
    </Card>
  );
}
