import Link from "next/link";
import DestinationPhoto from "@/components/common/DestinationPhoto";
import { destinationPhotoCredit } from "@/lib/destination-photo";
import type { DestinationCity } from "@/lib/destination-explorer";
import type { TouristSpot } from "@/types";
import styles from "./DestinationMap.module.css";

export default function DestinationCityPreview({ city, spot, ready, onPick }: {
  city: DestinationCity; spot?: TouristSpot; ready: boolean; onPick: (id: string) => void;
}) {
  const preview = spot ?? city.spots[0];
  const credit = destinationPhotoCredit(preview?.imageUrl);
  return <div className={styles.cityPanel}>
    <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-sky-100/60">Places in and around</p>
    <h4 className="mt-1 text-xl font-bold text-white">{city.name}</h4>
    {preview && <figure className="mt-4"><div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-slate-950/60"><DestinationPhoto imageUrl={preview.imageUrl} alt={`${preview.name}, ${city.name}`} sizes="(min-width:1024px) 550px, 90vw" className="object-contain" /></div><figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-100/75"><span>{preview.name}</span>{credit && <Link href={credit} className="underline underline-offset-4">Photo credit</Link>}</figcaption></figure>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-label={`Tourist places in ${city.name}`}>
      {city.spots.map(item => <button data-ui-action="" disabled={!ready} type="button" key={item.id} aria-pressed={spot?.id === item.id} onClick={() => onPick(item.id)} className={`overflow-hidden rounded-2xl border text-left ${spot?.id === item.id ? "border-amber-300 bg-amber-300 text-slate-950" : "border-sky-100/15 bg-white/5 text-sky-50 hover:border-amber-300/60"}`}>
        <span className="relative block aspect-[16/9] bg-slate-950/50"><DestinationPhoto imageUrl={item.imageUrl} alt={item.name} decorative sizes="(min-width:640px) 260px, 85vw" /></span>
        <span className="block px-3 py-3"><span className="block text-sm font-semibold">{item.name}</span><span className={`mt-1 block text-xs ${spot?.id === item.id ? "text-slate-800" : "text-sky-100/60"}`}>{item.tag || "Explore this place"}</span></span>
      </button>)}
    </div>
    {spot?.description && <p className="mt-4 text-sm leading-relaxed text-sky-100/75">{spot.description}</p>}
  </div>;
}
