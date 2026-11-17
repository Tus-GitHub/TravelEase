import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppConcierge from "@/components/layout/WhatsAppConcierge";
import ScrollProgress from "@/components/motion/ScrollProgress";
import { getCmsNavigation, getPublishedCmsPage } from "@/lib/server/published-cms";

// Published menu changes invalidate the shared public cache without a rebuild.
export const dynamic = "force-dynamic";

/** Chrome for every regular marketing/booking page: sticky navbar + footer. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [cmsNavigation, home] = await Promise.all([getCmsNavigation(), getPublishedCmsPage("home")]);
  return (
    <>
      <div className="site-grain" aria-hidden />
      <ScrollProgress />
      <Navbar cmsNavigation={cmsNavigation} header={home?.chrome?.header} />
      {/* Clip reveal transforms without creating a separate scroll container. */}
      <div className="site-page-content overflow-x-clip">
        {children}
        <Footer cmsNavigation={cmsNavigation} chrome={home?.chrome} />
      </div>
      <WhatsAppConcierge />
    </>
  );
}
