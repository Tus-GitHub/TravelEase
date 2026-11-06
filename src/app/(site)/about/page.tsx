import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CmsRenderer from "@/components/cms/CmsRenderer";
import { getPublishedCmsPage } from "@/lib/server/cms";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedCmsPage("about");
  return page ? { title: page.seo.title, description: page.seo.description } : {};
}
export default async function AboutPage() {
  const page = await getPublishedCmsPage("about");
  if (!page) notFound();
  return <CmsRenderer document={page} />;
}
