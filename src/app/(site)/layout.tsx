import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

/** Chrome for every regular marketing/booking page: sticky navbar + footer. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
