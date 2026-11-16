import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import PackageCard from "@/components/cards/PackageCard";
import type { TravelPackage } from "@/types";
import { cmsHeading, type CmsSection } from "@/lib/cms";

export default function PackageShowcase({ packages, cms }: { packages: TravelPackage[]; cms?: CmsSection }) {
  return <Section bg="gray" eyebrow="Ready-made getaways" title="Start with a travel package" subtitle="Explore the itinerary, stays, meals and activities listed in each package before you book." {...cmsHeading(cms)}>
    {packages.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{packages.slice(0, 3).map(pkg => <PackageCard key={pkg.id} pkg={pkg} />)}</div> : <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-6 text-center"><h3 className="font-display text-xl font-semibold text-fg">New packages are being planned</h3><p className="mt-3 text-sm leading-relaxed text-muted">Published itineraries and prices will appear here. You can explore trip planning or contact our team about a getaway.</p></div>}
    <div className="mt-8 flex flex-wrap justify-center gap-3"><Button href="/packages" variant="accent">Explore packages</Button><Button href="/booking?mode=custom" variant="outline">Create your own package</Button></div>
  </Section>;
}
