import { cache, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import Section from "@/components/common/Section";
import Grid from "@/components/common/Grid";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import HeroSection from "@/components/sections/HeroSection";
import TravelAnimationBand from "@/components/ui/TravelAnimationBand";
import DestinationMap from "@/components/sections/DestinationMap";
import VehicleCategories from "@/components/sections/VehicleCategories";
import FeaturedVehicles from "@/components/sections/FeaturedVehicles";
import PackageShowcase from "@/components/sections/PackageShowcase";
import HowItWorks from "@/components/sections/HowItWorks";
import PackageBuilder from "@/components/sections/PackageBuilder";
import WhyChooseUs from "@/components/sections/WhyChooseUs";
import Testimonials from "@/components/sections/Testimonials";
import { listPublicPackages, listPublicRegions, listPublicVehicles, toCardPackage, toBuilderRegion } from "@/lib/server/catalogue";
import { cmsText, cmsItems, cmsHeading, type CmsDocument, type CmsSection } from "@/lib/cms";
import { loadCatalogue } from '@/lib/server/cms-catalogue';
import CatalogueBrowser from './CatalogueBrowser';

function Paragraphs({ text }: { text: string }) {
  return <div className="space-y-4">{text.split(/\n\s*\n/).filter(Boolean).map((paragraph, i) => <p key={i} className="whitespace-pre-line text-muted">{paragraph}</p>)}</div>;
}
function ContentSection({ section }: { section: CmsSection }) {
  const items = cmsItems(section) ?? [], photo = cmsText(section, "imageUrl");
  const button = cmsText(section, "buttonLabel") && cmsText(section, "buttonHref") ? <Button href={cmsText(section, "buttonHref")} variant="accent" size="lg" iconRight="arrow-right">{cmsText(section, "buttonLabel")}</Button> : null;
  return <Section {...cmsHeading(section)}>
    {section.type === "text" && <>
      <div className="mx-auto max-w-3xl"><Paragraphs text={cmsText(section, "body")} /></div>
      {items.length > 0 && <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">{items.map((item, i) => <div key={i} className="text-center"><dt className="font-display text-3xl font-bold text-primary-900 dark:text-primary-300">{item.value}</dt><dd className="mt-1 text-xs text-muted">{item.label}</dd></div>)}</dl>}
    </>}
    {section.type === "timeline" && <div className="mx-auto max-w-3xl"><Grid cols={{ base: 1, sm: 2 }}>{items.map((item, i) => <Card key={i} padded hover={false}><span className="font-display text-sm font-bold text-accent-500">{item.year}</span><h3 className="mt-1 font-display text-lg font-semibold text-fg">{item.title}</h3><p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p></Card>)}</Grid></div>}
    {section.type === "image-text" && <div className="grid items-center gap-10 md:grid-cols-2">
      <div className={`relative aspect-[4/3] overflow-hidden rounded-3xl bg-surface-muted ${cmsText(section, "imageSide") === "right" ? "md:order-2" : ""}`}>{photo ? <Image src={photo} alt={cmsText(section, "imageAlt")} fill sizes="(max-width:768px) 100vw,50vw" className="object-cover" /> : <div className="flex h-full items-center justify-center text-muted">Your journey starts here</div>}</div>
      <div><Paragraphs text={cmsText(section, "body")} />{button && <div className="mt-7">{button}</div>}</div>
    </div>}
    {section.type === "cards" && <Grid cols={{ base: 1, sm: 2, lg: 3 }}>{items.map((item, i) => <Card key={i} className="overflow-hidden">{item.imageUrl && <div className="relative aspect-[16/10]"><Image src={item.imageUrl} alt={item.imageAlt || item.title} fill sizes="(max-width:768px) 100vw,33vw" className="object-cover" /></div>}<div className="p-6"><h3 className="font-display text-xl font-bold text-fg">{item.title}</h3><p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{item.body}</p>{item.href && <Link href={item.href} className="mt-5 inline-flex font-semibold text-accent-500">Explore →</Link>}</div></Card>)}</Grid>}
    {section.type === "faq" && <div className="mx-auto max-w-3xl space-y-3">{items.map((item, i) => <details key={i} className="rounded-2xl border border-line bg-surface p-5"><summary className="cursor-pointer font-semibold text-fg">{item.question}</summary><p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted">{item.answer}</p></details>)}</div>}
    {section.type === "cta" && <div className="text-center">{button}</div>}
  </Section>;
}

// Request-scoped deduplication: repeated sections share reads without caching
// catalogue availability across visitors or delaying the hero's initial HTML.
const getPackages = cache(async () => (await listPublicPackages()).map(toCardPackage));
const getRegions = cache(async () => (await listPublicRegions()).map(toBuilderRegion));
const getVehicles = cache(() => listPublicVehicles({ availableOnly: true }));

async function DataSection({ section }: { section: CmsSection }) {
  switch (section.type) {
    case "catalogue": return <CatalogueBrowser section={section} initialRows={await loadCatalogue(section.content)} />;
    case "featured-vehicles": return <FeaturedVehicles cms={section} vehicles={await getVehicles()} />;
    case "packages": return <PackageShowcase cms={section} packages={await getPackages()} />;
    case "package-builder": {
      const [packages, regions] = await Promise.all([getPackages(), getRegions()]);
      return <PackageBuilder cms={section} packages={packages} regions={regions} />;
    }
    default: return null;
  }
}

function PendingSection({ section }: { section: CmsSection }) {
  return <Section {...cmsHeading(section)}>
    <div role="status" aria-busy="true" className="flex min-h-64 items-center justify-center rounded-3xl border border-line bg-surface-muted p-6 text-center text-muted">
      Loading {cmsText(section, "title", "trip options")}…
    </div>
  </Section>;
}

/** The same streaming renderer powers saved draft previews and publications. */
export default function CmsRenderer({ document }: { document: CmsDocument }) {
  const sections = document.sections.filter(section => section.visible);
  return <main className={sections[0]?.type === "hero" ? "" : "pt-20"} data-cms-page>
    {!sections.some(section => section.type === "hero") && <h1 className="sr-only">{document.seo.title}</h1>}
    {sections.map(section => {
      switch (section.type) {
        case "catalogue":
        case "featured-vehicles":
        case "packages":
        case "package-builder": return <Suspense key={section.id} fallback={<PendingSection section={section} />}><DataSection section={section} /></Suspense>;
        case "hero": return <HeroSection key={section.id} cms={section} />;
        case "travel-band": { const photo = cmsText(section, "imageUrl") || (section.appearance.background === "image" ? section.appearance.imageUrl : ""); return <div key={section.id} id={`section-${section.id}`} data-cms-section={section.id}>{photo ? <div className="relative h-60"><Image src={photo} alt={cmsText(section, "imageAlt")} fill sizes="100vw" className="object-cover" /></div> : <TravelAnimationBand />}</div>; }
        case "destinations": return <DestinationMap key={section.id} cms={section} />;
        case "vehicle-categories": return <VehicleCategories key={section.id} cms={section} />;
        case "how-it-works": return <HowItWorks key={section.id} cms={section} />;
        case "features": return <WhyChooseUs key={section.id} cms={section} />;
        case "testimonials": return <Testimonials key={section.id} cms={section} />;
        default: return <ContentSection key={section.id} section={section} />;
      }
    })}
  </main>;
}
