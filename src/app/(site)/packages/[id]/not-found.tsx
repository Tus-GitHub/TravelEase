import Section from "@/components/common/Section";
import Button from "@/components/common/Button";

export default function PackageNotFound() {
  return (
    <Section bg="gray">
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-fg">Package not found</h1>
        <p className="mt-2 text-sm text-muted">
          This package may have been removed, or the link is incorrect.
        </p>
        <div className="mt-6">
          <Button href="/packages" variant="accent">
            Browse all packages
          </Button>
        </div>
      </div>
    </Section>
  );
}
