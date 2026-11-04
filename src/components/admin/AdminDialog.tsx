"use client";
import BrandedDialog from "@/components/common/BrandedDialog";
export default function AdminDialog(props: React.ComponentProps<typeof BrandedDialog>) {
  return <BrandedDialog {...props} brand="Jagdamba Travellers · Admin" />;
}
