import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import Card from "@/components/common/Card";
import Icon from "@/components/common/Icon";
import SearchForm from "@/components/forms/SearchForm";
import { bookingSteps, popularRoutes } from "@/data/pages";

export const metadata: Metadata = {
  title: "Book a Trip — TravelEase",
  description:
    "Search chauffeur-driven vehicles for airport transfers, outstation trips, hourly rentals and multi-day packages.",
};

export default function BookingPage() {
  return (
    <>
      <Section
        bg="primary"
        eyebrow="Book a Trip"
        title="Where are you headed?"
        subtitle="Tell us your route and date — we'll show chauffeur-driven vehicles with all-inclusive fares."
      >
        <div className="mx-auto max-w-4xl">
          <SearchForm />
        </div>
      </Section>

      <Section bg="white" eyebrow="How it works" title="Booking in three steps">
        <Grid cols={{ base: 1, md: 3 }}>
          {bookingSteps.map((step, i) => (
            <Card key={step.title} padded hover={false}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-800 dark:bg-primary-950 dark:text-primary-300">
                  <Icon name={step.icon} className="h-5 w-5" />
                </span>
                <span className="font-display text-sm font-bold text-faint">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-fg">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
            </Card>
          ))}
        </Grid>
      </Section>

      <Section
        bg="gray"
        eyebrow="Popular Routes"
        title="Frequently booked journeys"
        subtitle="A few routes travellers book often. Start a search to see live options."
      >
        <Grid cols={{ base: 1, sm: 2, lg: 3 }}>
          {popularRoutes.map((route) => (
            <Link key={`${route.from}-${route.to}`} href="/vehicles">
              <Card padded className="h-full">
                <div className="flex items-center gap-2 font-display font-semibold text-fg">
                  {route.from}
                  <Icon name="arrow-right" className="h-4 w-4 shrink-0 text-accent-500" />
                  {route.to}
                </div>
                <p className="mt-1.5 text-xs text-muted">{route.note}</p>
              </Card>
            </Link>
          ))}
        </Grid>
      </Section>
    </>
  );
}
