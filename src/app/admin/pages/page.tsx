import { notFound } from "next/navigation";
import { requireRole } from "@/lib/server/auth-guard";
import CmsPages from "@/components/cms/CmsPages";
export const dynamic = "force-dynamic";
export default async function PagesAdmin() {
  const auth = await requireRole("admin"); if (!auth.ok) notFound();
  return <CmsPages />;
}
