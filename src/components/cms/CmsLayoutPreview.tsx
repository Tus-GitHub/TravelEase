import Icon from "@/components/common/Icon";
import type { CmsSectionType } from "@/lib/cms";

/** Lightweight layout illustrations; no catalogue requests, map services or image downloads. */
export default function CmsLayoutPreview({ type }: { type: CmsSectionType }) {
  const lines = <><span className="block h-2 w-3/4 rounded bg-slate-300" /><span className="mt-2 block h-1.5 w-full rounded bg-slate-200" /><span className="mt-1 block h-1.5 w-5/6 rounded bg-slate-200" /></>;
  const picture = <span className="flex h-full min-h-14 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-teal-100"><Icon name="image" className="h-7 w-7 text-teal-700" /></span>;
  const cards = (count: number, icons = false) => <span className={`grid h-full gap-2 ${count === 4 ? "grid-cols-4" : "grid-cols-3"}`}>{Array.from({ length: count }, (_, i) => <span key={i} className="block rounded-lg border border-slate-200 bg-white p-2">{icons ? <Icon name={i % 2 ? "shield-check" : "car"} className="mb-3 h-5 w-5 text-amber-600" /> : <span className="mb-2 block h-8 rounded bg-blue-100" />}{lines}</span>)}</span>;
  return <div aria-label={`${type.replaceAll("-", " ")} layout preview`} className="h-36 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-800">
    <div className="mb-3 flex justify-center"><span className="h-2 w-2/5 rounded bg-slate-400" /></div><div className="h-24">
      {type === "hero" ? <div className="grid h-full grid-cols-2 gap-3"><div className="pt-3">{lines}<span className="mt-3 block h-5 w-16 rounded bg-amber-400" /></div>{picture}</div>
      : type === "image-text" ? <div className="grid h-full grid-cols-2 gap-3">{picture}<div className="pt-3">{lines}</div></div>
      : type === "text" ? <div className="mx-auto max-w-52 space-y-4">{lines}<div className="grid grid-cols-3 gap-3">{[1, 2, 3].map(n => <span key={n} className="rounded bg-blue-100 p-2 text-center text-xs font-bold">{n}0+</span>)}</div></div>
      : type === "timeline" || type === "how-it-works" ? <div className="grid grid-cols-3 gap-3 border-t-2 border-teal-500 pt-3">{[1, 2, 3].map(n => <span key={n} className="block"><span className="mb-2 block text-xs font-bold text-teal-700">0{n}</span>{lines}</span>)}</div>
      : type === "faq" ? <div className="space-y-2">{[1, 2, 3].map(n => <span key={n} className="flex justify-between rounded-lg border border-slate-200 bg-white p-2"><span className="h-2 w-3/4 rounded bg-slate-200" /><span className="text-xs">+</span></span>)}</div>
      : type === "destinations" ? <div className="grid h-full grid-cols-2 gap-3"><span className="flex items-center justify-center rounded-xl bg-primary-900"><Icon name="map-pin" className="h-12 w-12 text-amber-400" /></span><div className="space-y-2">{picture}</div></div>
      : type === "package-builder" ? <div><div className="mb-2 flex gap-1 rounded-lg bg-slate-200 p-1"><span className="h-4 flex-1 rounded bg-blue-900" /><span className="h-4 flex-1 rounded bg-white" /></div>{cards(3)}</div>
      : type === "cta" ? <div className="flex h-full flex-col items-center justify-center rounded-xl bg-blue-950"><span className="h-2 w-1/2 rounded bg-white/80" /><span className="mt-4 h-6 w-24 rounded-lg bg-amber-400" /></div>
      : type === "travel-band" ? <div className="flex h-full items-center justify-around rounded-xl bg-blue-950"><Icon name="map-pin" className="h-7 w-7 text-amber-400" /><span className="h-px w-1/3 border-t border-dashed border-white/60" /><Icon name="bus" className="h-9 w-9 text-white" /></div>
      : cards(type === "features" || type === "vehicle-categories" ? 4 : 3, type === "features" || type === "testimonials")}
    </div>
  </div>;
}
