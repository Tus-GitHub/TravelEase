import Image from "next/image";
import Link from "next/link";
import credits from "@/data/destination-photo-credits.json";

export const metadata = { title: "Photo credits | Jagdamba Travellers", description: "Photographers, source files and reuse licenses for our destination photographs." };

export default function ImageCreditsPage({ searchParams }: { searchParams: { photo?: string } }) {
  const selected = searchParams.photo;
  const shown = selected ? credits.filter(photo => photo.imageUrl.split("/").pop() === selected) : credits;
  return <main className="section-container py-12 sm:py-20">
    <p className="text-xs font-semibold uppercase tracking-widest text-accent-600">Behind the photographs</p>
    <h1 className="mt-3 font-display text-3xl font-bold text-fg sm:text-4xl">Photo credits</h1>
    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">Thank you to the photographers who make these places visible. Each image below links to its original source and license. Our copies are resized and converted to WebP; display thumbnails may be cropped. Each adapted photograph remains available under the license shown.</p>
    <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold"><Link href="/" className="underline underline-offset-4">Back to exploring</Link>{selected && <Link href="/image-credits" className="underline underline-offset-4">All photo credits</Link>}</div>
    {!shown.length && <p className="mt-8 text-muted">This photo is not in the imported collection. You can browse all credits above.</p>}
    <div className="mt-8 grid gap-5 lg:grid-cols-2">{shown.map(photo => <article key={photo.imageUrl} className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row"><div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden rounded-xl bg-canvas sm:w-40"><Image src={photo.imageUrl} alt={`${photo.place}, ${photo.city}`} fill sizes="(min-width:640px) 160px, 100vw" unoptimized className="object-contain" /></div><div className="min-w-0"><h2 className="font-semibold text-fg">{photo.place}</h2><p className="mt-1 text-sm text-muted">{photo.city} · {photo.state}</p><p className="mt-3 break-words text-sm text-fg">Photo: {photo.author}</p></div></div>
      <p className="mt-3 break-words text-xs leading-relaxed text-muted">{photo.title}</p>{photo.attribution && <p className="mt-2 break-words text-xs text-muted">{photo.attribution}</p>}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold"><a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Original source</a><a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{photo.license}</a><a href={photo.imageUrl} download className="underline underline-offset-4">Our image copy</a></div>
      <p className="mt-3 text-xs text-muted">{photo.changes}</p>
    </article>)}</div>
  </main>;
}
