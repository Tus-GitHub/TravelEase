"use client";
import BrandedDialog from "@/components/common/BrandedDialog";
export default function AccountEditor({ title, description = "Review your details, then save your changes.", children, busy = false, onClose }: {
  title: string; description?: string; children: React.ReactNode; busy?: boolean; onClose: () => void;
}) {
  return <BrandedDialog title={title} description={description} busy={busy} onClose={onClose}>
    <fieldset disabled={busy} className="min-w-0 p-5 sm:p-8">{children}</fieldset>
  </BrandedDialog>;
}
