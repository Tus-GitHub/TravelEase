import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CmsRenderer from "@/components/cms/CmsRenderer";
import { getPublishedCmsPage } from "@/lib/server/cms";
import { validateCmsSlug } from "@/lib/cms";
export const dynamic = "force-dynamic";
function slugOr404(slug: string) {
  try { if (slug === "home") notFound(); return validateCmsSlug(slug); } catch { notFound(); }
}
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await getPublishedCmsPage(slugOr404(params.slug));
  return page ? { title: page.seo.title, description: page.seo.description } : { robots: { index: false, follow: false } };
}
export default async function CustomPage({ params }: { params: { slug: string } }) {
  const page = await getPublishedCmsPage(slugOr404(params.slug));
  if (!page) notFound();
  return <CmsRenderer document={page} />;
}
