"use client";
import ActionDialog from "@/components/common/ActionDialog";
export type { ActionField } from "@/components/common/ActionDialog";
export default function AdminActionDialog(props: React.ComponentProps<typeof ActionDialog>) {
  return <ActionDialog {...props} brand="Jagdamba Travellers · Admin" />;
}
