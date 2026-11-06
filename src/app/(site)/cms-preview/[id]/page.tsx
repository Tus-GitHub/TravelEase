import { notFound } from "next/navigation";
import CmsRenderer from "@/components/cms/CmsRenderer";
import { requireRole } from "@/lib/server/auth-guard";
import { getCmsPage } from "@/lib/server/cms";
import { CmsError } from "@/lib/cms";
export const dynamic = "force-dynamic";
export const metadata = { title: "Draft preview", robots: { index: false, follow: false } };
export default async function CmsPreview({ params }: { params: { id: string } }) {
  const auth = await requireRole("admin");
  if (!auth.ok) notFound();
  let page;
  try { page = await getCmsPage(params.id); }
  catch (error) { if (error instanceof CmsError && error.status === 404) notFound(); throw error; }
  return <><div className="relative z-20 bg-amber-100 px-4 pb-3 pt-24 text-center text-sm font-semibold text-amber-950">Draft preview · Only administrators can see this version</div><CmsRenderer document={page.draft} /></>;
}
