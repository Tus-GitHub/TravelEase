import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import AnimateInView from "@/components/common/AnimateInView";
import CategoryCard from "@/components/cards/CategoryCard";
import { categories } from "@/data/categories";
import { cmsHeading, cmsItems, type CmsSection } from "@/lib/cms";
import type { VehicleCategory } from "@/types";

export default function VehicleCategories({ cms }: { cms?: CmsSection } = {}) {
  const items = cmsItems(cms)?.map((item, i) => ({ ...item, id: `${cms!.id}-${i}`, slug: `category-${i}` })) as VehicleCategory[] | undefined;
  return (
    <Section
      id="vehicles"
      bg="gray"
      eyebrow="Explore Options"
      title="Find the Right Vehicle for Every Trip"
      subtitle="Whether it's a family getaway, a corporate offsite or an airport run, we have a category made for you."
      {...cmsHeading(cms)}
    >
      <Grid cols={{ base: 1, sm: 2, lg: 3, xl: 5 }}>
        {(items ?? categories).map((category, i) => (
          <AnimateInView key={category.id} delay={i * 0.1}>
            <CategoryCard category={category} />
          </AnimateInView>
        ))}
      </Grid>
    </Section>
  );
}
