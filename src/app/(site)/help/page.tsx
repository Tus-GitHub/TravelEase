import type { Metadata } from "next";
import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import { faqs } from "@/data/pages";

export const metadata: Metadata = {
  title: "Help Center — TravelEase",
  description: "Answers to common questions about booking, payments, cancellations, vehicles and drivers.",
};

export default function HelpPage() {
  return (
    <Section
      bg="gray"
      eyebrow="Help Center"
      title="Frequently asked questions"
      subtitle="Quick answers on booking, payments, cancellations and the fleet."
    >
      <div className="mx-auto max-w-3xl space-y-10">
        {faqs.map((group) => (
          <div key={group.category}>
            <div className="flex items-center gap-2">
              <Icon name={group.icon} className="h-5 w-5 text-primary-700" />
              <h2 className="font-display text-lg font-bold text-slate-900">{group.category}</h2>
            </div>
            <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {group.items.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-slate-800 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <Icon
                      name="chevron-down"
                      className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-3xl rounded-2xl bg-primary-50 px-6 py-7 text-center">
        <p className="text-sm text-slate-600">Still stuck? Our team is a message away.</p>
        <div className="mt-3">
          <Button href="/contact" variant="accent" size="sm">
            Contact support
          </Button>
        </div>
      </div>
    </Section>
  );
}
