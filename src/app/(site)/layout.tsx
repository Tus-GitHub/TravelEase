import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SmoothScroll from "@/components/motion/SmoothScroll";
import ScrollProgress from "@/components/motion/ScrollProgress";

/** Chrome for every regular marketing/booking page: sticky navbar + footer. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <ScrollProgress />
      <Navbar />
      {children}
      <Footer />
    </SmoothScroll>
  );
}
