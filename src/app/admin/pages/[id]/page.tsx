import { notFound } from "next/navigation";
import { requireRole } from "@/lib/server/auth-guard";
import { getCmsPage, listCmsRevisions } from "@/lib/server/cms";
import { CmsError } from "@/lib/cms";
import CmsEditor from "@/components/cms/CmsEditor";
export const dynamic = "force-dynamic";
export default async function PageEditor({ params }: { params: { id: string } }) {
  const auth = await requireRole("admin"); if (!auth.ok) notFound();
  try {
    const [page, revisions] = await Promise.all([getCmsPage(params.id), listCmsRevisions(params.id)]);
    return <CmsEditor initialPage={page} initialRevisions={revisions} />;
  } catch (error) { if (error instanceof CmsError && error.status === 404) notFound(); throw error; }
}
