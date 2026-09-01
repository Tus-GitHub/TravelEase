import type { Metadata } from "next";
import Section from "@/components/common/Section";
import ContactForm from "@/components/pages/ContactForm";

export const metadata: Metadata = {
  title: "Contact Jagdamba Travellers",
  description: "Get in touch with the Jagdamba Travellers team for booking help, billing questions or feedback.",
};

export default function ContactPage() {
  return (
    <Section
      bg="gray"
      eyebrow="Contact"
      title="Talk to us"
      subtitle="Booking help, billing questions, partnerships or feedback — we read every message."
    >
      <div className="mx-auto max-w-4xl">
        <ContactForm />
      </div>
    </Section>
  );
}
