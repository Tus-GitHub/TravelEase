import Section from "@/components/common/Section";
import AnimateInView from "@/components/common/AnimateInView";
import Button from "@/components/common/Button";
import TiltCard from "@/components/motion/TiltCard";
import VehicleCard from "@/components/cards/VehicleCard";
import { listPublicVehicles, toCardVehicle, type PublicVehicle } from "@/lib/server/catalogue";
import { cmsHeading, cmsText, type CmsSection } from "@/lib/cms";

export default async function FeaturedVehicles({ cms, vehicles }: { cms?: CmsSection; vehicles?: PublicVehicle[] } = {}) {
  const featured = (vehicles ?? await listPublicVehicles({ availableOnly: true }))
    .slice(0, 4)
    .map(toCardVehicle);

  if (featured.length === 0) return null;

  return (
    <Section
      id="featured"
      bg="white"
      eyebrow="Choose your ride"
      title="Designed for the journey"
      subtitle="Chauffeur-driven, immaculately kept, priced up front — pick the one that fits the trip."
      {...cmsHeading(cms)}
    >
      <div
        className={
          featured.length === 1
            ? "mx-auto max-w-md"
            : featured.length === 2
              ? "mx-auto grid max-w-4xl gap-8 sm:grid-cols-2"
              : featured.length === 3
                ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                : "grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        }
      >
        {featured.map((vehicle, i) => (
          <AnimateInView key={vehicle.id} delay={i * 0.08}>
            <TiltCard className="h-full">
              <VehicleCard vehicle={vehicle} />
            </TiltCard>
          </AnimateInView>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Button href={cmsText(cms, "buttonHref", "/vehicles")} variant="outline" size="lg" iconRight="arrow-right">
          {cmsText(cms, "buttonLabel", "View All Vehicles")}
        </Button>
      </div>
    </Section>
  );
}
