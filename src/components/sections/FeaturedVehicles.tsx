import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import AnimateInView from "@/components/common/AnimateInView";
import Button from "@/components/common/Button";
import TiltCard from "@/components/motion/TiltCard";
import VehicleCard from "@/components/cards/VehicleCard";
import { listPublicVehicles, toCardVehicle } from "@/lib/server/catalogue";

export default async function FeaturedVehicles() {
  const featured = (await listPublicVehicles({ availableOnly: true }))
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
    >
      <Grid cols={{ base: 1, sm: 2, lg: 4 }}>
        {featured.map((vehicle, i) => (
          <AnimateInView key={vehicle.id} delay={i * 0.08}>
            <TiltCard className="h-full">
              <VehicleCard vehicle={vehicle} />
            </TiltCard>
          </AnimateInView>
        ))}
      </Grid>

      <div className="mt-12 text-center">
        <Button href="/vehicles" variant="outline" size="lg" iconRight="arrow-right">
          View All Vehicles
        </Button>
      </div>
    </Section>
  );
}
