import Section from "@/components/common/Section";

export interface PolicySection {
  heading: string;
  body: string[];
}

interface PolicyPageProps {
  eyebrow?: string;
  title: string;
  intro: string;
  updated: string;
  sections: PolicySection[];
  /** Optional extra content rendered between the intro and the numbered sections. */
  children?: React.ReactNode;
}

/** Shared shell for prose pages: Terms, Privacy, Cancellation Policy. */
export default function PolicyPage({
  eyebrow = "Legal",
  title,
  intro,
  updated,
  sections,
  children,
}: PolicyPageProps) {
  return (
    <Section bg="gray" eyebrow={eyebrow} title={title}>
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-wide text-faint">
          Last updated: {updated}
        </p>
        <p className="mt-4 text-muted">{intro}</p>

        {children}

        <div className="mt-10 space-y-8">
          {sections.map((section, i) => (
            <section key={section.heading}>
              <h2 className="font-display text-lg font-bold text-fg">
                {i + 1}. {section.heading}
              </h2>
              {section.body.map((paragraph, j) => (
                <p key={j} className="mt-2 text-sm leading-relaxed text-muted">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
          Questions about this page?{" "}
          <a href="/contact" className="font-medium text-primary-700 hover:underline">
            Contact us
          </a>
          .
        </p>
      </div>
    </Section>
  );
}
