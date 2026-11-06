import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import AnimateInView from "@/components/common/AnimateInView";
import FeatureCard from "@/components/cards/FeatureCard";
import { features } from "@/data/features";
import { cmsHeading, cmsItems, type CmsSection } from "@/lib/cms";
import type { Feature } from "@/types";

export default function WhyChooseUs({ cms }: { cms?: CmsSection } = {}) {
  const entries = cmsItems(cms)?.map((item, i) => ({ ...item, id: `${cms!.id}-${i}` })) as Feature[] | undefined;
  const dark = !cms || !["light", "muted"].includes(cms.appearance.background);
  return (
    <Section
      id="why-us"
      bg="primary"
      eyebrow="Why Choose Us"
      title="Travel With Total Peace of Mind"
      subtitle="We obsess over the details so your journey is safe, comfortable and completely hassle-free."
      {...cmsHeading(cms)}
    >
      <Grid cols={{ base: 1, sm: 2, lg: 4 }}>
        {(entries ?? features).map((feature, i) => (
          <AnimateInView key={feature.id} delay={i * 0.12} y={20}>
            <FeatureCard feature={feature} dark={dark} />
          </AnimateInView>
        ))}
      </Grid>
    </Section>
  );
}
