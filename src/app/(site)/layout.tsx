import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SmoothScroll from "@/components/motion/SmoothScroll";
import ScrollProgress from "@/components/motion/ScrollProgress";

/** Chrome for every regular marketing/booking page: sticky navbar + footer. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <div className="site-grain" aria-hidden />
      <ScrollProgress />
      <Navbar />
      {/*
        Contains transient horizontal overflow from scroll-reveal transforms
        (e.g. a panel sitting at translateX(40px) before its trigger fires)
        WITHOUT putting `overflow` on html/body — that would break Lenis's
        wheel/touch scrolling. `clip` establishes no scroll container, so the
        document still scrolls and `position: sticky` still works.
      */}
      <div className="overflow-x-clip">
        {children}
        <Footer />
      </div>
    </SmoothScroll>
  );
}
