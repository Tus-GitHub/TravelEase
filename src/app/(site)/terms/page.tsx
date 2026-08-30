import type { Metadata } from "next";
import PolicyPage from "@/components/pages/PolicyPage";
import { legalUpdated, termsIntro, termsSections } from "@/data/pages";

export const metadata: Metadata = {
  title: "Terms of Service — TravelEase",
};

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of Service"
      updated={legalUpdated}
      intro={termsIntro}
      sections={termsSections}
    />
  );
}
