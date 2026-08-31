import type { Metadata } from "next";
import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import Card from "@/components/common/Card";
import WhyChooseUs from "@/components/sections/WhyChooseUs";
import Testimonials from "@/components/sections/Testimonials";
import { aboutIntro, aboutStats, aboutStory } from "@/data/pages";

export const metadata: Metadata = {
  title: "About TravelEase",
  description:
    "Why TravelEase exists: chauffeur-driven trips across India with verified drivers and fully transparent fares.",
};

export default function AboutPage() {
  return (
    <>
      <Section bg="gray" eyebrow="About Us" title="Travel across India, without the guesswork">
        <div className="mx-auto max-w-3xl space-y-4">
          {aboutIntro.map((paragraph) => (
            <p key={paragraph} className="text-muted">
              {paragraph}
            </p>
          ))}
        </div>

        <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          {aboutStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <dt className="font-display text-3xl font-bold text-primary-900 dark:text-primary-300 ">
                {stat.value}
              </dt>
              <dd className="mt-1 text-xs text-muted">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section bg="white" eyebrow="Our Story" title="How we got here">
        <div className="mx-auto max-w-3xl">
          <Grid cols={{ base: 1, sm: 2 }}>
            {aboutStory.map((milestone) => (
              <Card key={milestone.year} padded hover={false}>
                <span className="font-display text-sm font-bold text-accent-500">
                  {milestone.year}
                </span>
                <h3 className="mt-1 font-display text-lg font-semibold text-fg">
                  {milestone.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {milestone.body}
                </p>
              </Card>
            ))}
          </Grid>
        </div>
      </Section>

      <WhyChooseUs />
      <Testimonials />
    </>
  );
}
