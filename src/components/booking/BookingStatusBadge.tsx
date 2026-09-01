import Badge from "@/components/common/Badge";

const TONE: Record<string, "neutral" | "primary" | "accent" | "success"> = {
  Draft: "neutral",
  PendingPayment: "accent",
  Confirmed: "primary",
  Ongoing: "primary",
  Completed: "success",
  Cancelled: "neutral",
  Refunded: "neutral",
};

const LABEL: Record<string, string> = {
  PendingPayment: "Pending payment",
};

export default function BookingStatusBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{LABEL[status] ?? status}</Badge>;
}
