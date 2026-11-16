import { notFound } from "next/navigation";
import { requireRole } from "@/lib/server/auth-guard";
import { getCmsPage, listCmsRevisions } from "@/lib/server/cms";
import { CmsError } from "@/lib/cms";
import CmsEditor from "@/components/cms/CmsEditor";
import { getCmsNavigation } from "@/lib/server/published-cms";
export const dynamic = "force-dynamic";
export default async function PageEditor({ params, searchParams }: { params: { id: string }; searchParams: { section?: string } }) {
  const auth = await requireRole("admin"); if (!auth.ok) notFound();
  try {
    const [page, revisions, navigation] = await Promise.all([getCmsPage(params.id), listCmsRevisions(params.id), getCmsNavigation()]);
    const section = page.slug === "home" && (searchParams.section === "header" || searchParams.section === "footer") ? searchParams.section : undefined;
    return <CmsEditor key={`${page.id}:${section ?? "content"}`} initialPage={page} initialRevisions={revisions} initialSection={section} initialNavigation={navigation} />;
  } catch (error) { if (error instanceof CmsError && error.status === 404) notFound(); throw error; }
}
