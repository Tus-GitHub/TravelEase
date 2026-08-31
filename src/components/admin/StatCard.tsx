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
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-900 dark:bg-primary-950 dark:text-primary-300">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-bold text-fg">{value}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </Card>
  );
}
