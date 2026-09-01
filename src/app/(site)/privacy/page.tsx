import type { Metadata } from "next";
import PolicyPage from "@/components/pages/PolicyPage";
import { legalUpdated, privacyIntro, privacySections } from "@/data/pages";

export const metadata: Metadata = {
  title: "Privacy Policy — Jagdamba Travellers",
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      updated={legalUpdated}
      intro={privacyIntro}
      sections={privacySections}
    />
  );
}
