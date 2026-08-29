import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import AnimateInView from "@/components/common/AnimateInView";
import Button from "@/components/common/Button";
import VehicleCard from "@/components/cards/VehicleCard";
import { vehicles } from "@/data/vehicles";

export default function FeaturedVehicles() {
  const featured = vehicles.slice(0, 4);

  return (
    <Section
      id="featured"
      bg="white"
      eyebrow="Our Fleet"
      title="Featured Vehicles"
      subtitle="Hand-picked, well-maintained vehicles with transparent daily pricing."
    >
      <Grid cols={{ base: 1, sm: 2, lg: 4 }}>
        {featured.map((vehicle, i) => (
          <AnimateInView key={vehicle.id} delay={i * 0.1}>
            <VehicleCard vehicle={vehicle} />
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
