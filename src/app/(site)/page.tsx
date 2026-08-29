import HeroSection from "@/components/sections/HeroSection";
import TravelAnimationBand from "@/components/ui/TravelAnimationBand";
import PackageBuilder from "@/components/sections/PackageBuilder";
import VehicleCategories from "@/components/sections/VehicleCategories";
import WhyChooseUs from "@/components/sections/WhyChooseUs";
import FeaturedVehicles from "@/components/sections/FeaturedVehicles";
import Testimonials from "@/components/sections/Testimonials";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <TravelAnimationBand />
      <PackageBuilder />
      <VehicleCategories />
      <WhyChooseUs />
      <FeaturedVehicles />
      <Testimonials />
    </main>
  );
}
