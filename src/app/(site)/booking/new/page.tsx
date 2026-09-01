import { Suspense } from "react";
import type { Metadata } from "next";
import Section from "@/components/common/Section";
import BookingFlow from "@/components/booking/BookingFlow";

export const metadata: Metadata = {
  title: "Confirm your booking — TravelEase",
};

export default function BookingNewPage() {
  return (
    <Section
      bg="gray"
      eyebrow="Almost there"
      title="Confirm your trip"
      subtitle="Add your travel dates and details, see the price, and book."
    >
      <Suspense fallback={<p className="text-center text-sm text-muted">Loading…</p>}>
        <BookingFlow />
      </Suspense>
    </Section>
  );
}
