import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import AnimateInView from "@/components/common/AnimateInView";
import TestimonialCard from "@/components/cards/TestimonialCard";
import { testimonials } from "@/data/testimonials";

export default function Testimonials() {
  return (
    <Section
      id="reviews"
      bg="gray"
      eyebrow="Customer Experience"
      title="Loved by Travellers Everywhere"
      subtitle="Real stories from people who booked their journeys with us."
    >
      <Grid cols={{ base: 1, sm: 2, lg: 4 }}>
        {testimonials.map((testimonial, i) => (
          <AnimateInView key={testimonial.id} delay={i * 0.1}>
            <TestimonialCard testimonial={testimonial} />
          </AnimateInView>
        ))}
      </Grid>
    </Section>
  );
}
