import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CmsRenderer from "@/components/cms/CmsRenderer";
import { getPublishedCmsPage } from "@/lib/server/cms";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedCmsPage("home");
  return page ? { title: { absolute: page.seo.title }, description: page.seo.description } : {};
}
export default async function HomePage() {
  const page = await getPublishedCmsPage("home");
  if (!page) notFound();
  return <CmsRenderer document={page} />;
}
