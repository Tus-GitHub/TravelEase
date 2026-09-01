import HeroSection from "@/components/sections/HeroSection";
import TravelAnimationBand from "@/components/ui/TravelAnimationBand";
import DestinationMap from "@/components/sections/DestinationMap";
import VehicleCategories from "@/components/sections/VehicleCategories";
import FeaturedVehicles from "@/components/sections/FeaturedVehicles";
import PackageShowcase from "@/components/sections/PackageShowcase";
import HowItWorks from "@/components/sections/HowItWorks";
import PackageBuilder from "@/components/sections/PackageBuilder";
import WhyChooseUs from "@/components/sections/WhyChooseUs";
import Testimonials from "@/components/sections/Testimonials";
import {
  listPublicPackages,
  listPublicRegions,
  toCardPackage,
  toBuilderRegion,
} from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [pkgRows, regionRows] = await Promise.all([
    listPublicPackages(),
    listPublicRegions(),
  ]);
  const packages = pkgRows.map(toCardPackage);
  const regions = regionRows.map(toBuilderRegion);

  return (
    <main>
      <HeroSection />
      <TravelAnimationBand />
      <DestinationMap />
      <VehicleCategories />
      <FeaturedVehicles />
      <PackageShowcase packages={packages} />
      <HowItWorks />
      <PackageBuilder regions={regions} packages={packages} />
      <WhyChooseUs />
      <Testimonials />
    </main>
  );
}
