import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import AnimateInView from "@/components/common/AnimateInView";
import FeatureCard from "@/components/cards/FeatureCard";
import { features } from "@/data/features";

export default function WhyChooseUs() {
  return (
    <Section
      id="why-us"
      bg="primary"
      eyebrow="Why Choose Us"
      title="Travel With Total Peace of Mind"
      subtitle="We obsess over the details so your journey is safe, comfortable and completely hassle-free."
    >
      <Grid cols={{ base: 1, sm: 2, lg: 4 }}>
        {features.map((feature, i) => (
          <AnimateInView key={feature.id} delay={i * 0.12} y={20}>
            <FeatureCard feature={feature} />
          </AnimateInView>
        ))}
      </Grid>
    </Section>
  );
}
