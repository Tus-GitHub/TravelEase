import { Suspense } from "react";
import type { Metadata } from "next";
import Section from "@/components/common/Section";
import BookingFlow from "@/components/booking/BookingFlow";
import WeekendCheckout from "@/components/weekend/WeekendCheckout";

export const metadata: Metadata = {
  title: "Confirm your booking — Jagdamba Travellers",
};

export default function BookingNewPage({searchParams}:{searchParams:{departure?:string}}) {
  return (
    <Section
      bg="gray"
      className={searchParams.departure ? "pt-28 md:pt-32" : ""}
      eyebrow="Almost there"
      title="Confirm your trip"
      subtitle={searchParams.departure ? "Meet new people. Make new memories. Start with your traveller details." : "Add your travel dates and details, see the price, and book."}
    >
      <Suspense fallback={<p className="text-center text-sm text-muted">Loading…</p>}>
        {searchParams.departure ? <WeekendCheckout key={searchParams.departure} departureId={searchParams.departure}/> : <BookingFlow />}
      </Suspense>
    </Section>
  );
}
