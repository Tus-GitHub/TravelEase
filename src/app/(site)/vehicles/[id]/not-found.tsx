import Section from "@/components/common/Section";
import Button from "@/components/common/Button";

export default function VehicleNotFound() {
  return (
    <Section bg="gray">
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-fg">Vehicle not found</h1>
        <p className="mt-2 text-sm text-muted">
          This vehicle may have been removed, or the link is incorrect.
        </p>
        <div className="mt-6">
          <Button href="/vehicles" variant="accent">
            Browse all vehicles
          </Button>
        </div>
      </div>
    </Section>
  );
}
