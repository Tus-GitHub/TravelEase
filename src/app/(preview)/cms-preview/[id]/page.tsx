import { notFound } from "next/navigation";
import CmsRenderer from "@/components/cms/CmsRenderer";
import { requireRole } from "@/lib/server/auth-guard";
import { getCmsPage } from "@/lib/server/cms";
import { CmsError, cmsPath } from "@/lib/cms";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getCmsNavigation, getPublishedCmsPage } from "@/lib/server/published-cms";
export const dynamic = "force-dynamic";
export const metadata = { title: "Draft preview", robots: { index: false, follow: false } };
export default async function CmsPreview({ params }: { params: { id: string } }) {
  const auth = await requireRole("admin");
  if (!auth.ok) notFound();
  let page;
  try { page = await getCmsPage(params.id); }
  catch (error) { if (error instanceof CmsError && error.status === 404) notFound(); throw error; }
  const [navigation, home] = await Promise.all([getCmsNavigation(), page.slug === "home" ? null : getPublishedCmsPage("home")]);
  const chrome = page.slug === "home" ? page.draft.chrome : home?.chrome;
  const path = cmsPath(page.slug), first = page.draft.sections.find(section => section.visible);
  const previewNavigation = [...navigation.filter(item => item.href !== path), { ...page.draft.navigation, href: path, darkHero: first?.type === "hero" && !["light", "muted"].includes(first.appearance.background) }];
  return <><Navbar cmsNavigation={previewNavigation} header={chrome?.header} previewPath={path} /><div className="relative z-20 bg-amber-100 px-4 pb-3 pt-24 text-center text-sm font-semibold text-amber-950">Draft preview · Only administrators can see this version</div><CmsRenderer document={page.draft} /><Footer cmsNavigation={previewNavigation} chrome={chrome} /></>;
}
