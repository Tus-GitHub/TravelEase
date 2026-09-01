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
import { listPublicPackages, toCardPackage } from "@/lib/server/catalogue";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const packages = (await listPublicPackages()).map(toCardPackage);

  return (
    <main>
      <HeroSection />
      <TravelAnimationBand />
      <DestinationMap />
      <VehicleCategories />
      <FeaturedVehicles />
      <PackageShowcase packages={packages} />
      <HowItWorks />
      <PackageBuilder />
      <WhyChooseUs />
      <Testimonials />
    </main>
  );
}
