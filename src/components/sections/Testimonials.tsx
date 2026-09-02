import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import AnimateInView from "@/components/common/AnimateInView";
import TestimonialCard from "@/components/cards/TestimonialCard";
import { testimonials } from "@/data/testimonials";
import { listPublishedReviews, toTestimonial } from "@/lib/server/reviews";

export default async function Testimonials() {
  const real = (await listPublishedReviews(8)).map(toTestimonial);
  // Fall back to the seeded testimonials until real reviews come in.
  const items = real.length >= 3 ? real.slice(0, 4) : testimonials;

  return (
    <Section
      id="reviews"
      bg="gray"
      eyebrow="Customer Experience"
      title="Loved by Travellers Everywhere"
      subtitle="Real stories from people who booked their journeys with us."
    >
      <Grid cols={{ base: 1, sm: 2, lg: 4 }}>
        {items.map((testimonial, i) => (
          <AnimateInView key={testimonial.id} delay={i * 0.1}>
            <TestimonialCard testimonial={testimonial} />
          </AnimateInView>
        ))}
      </Grid>
    </Section>
  );
}
