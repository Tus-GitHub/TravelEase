import Link from "next/link";
import Icon from "@/components/common/Icon";

const choices = [
  { title: "Ready-made packages", text: "Explore planned itineraries and see exactly what is included.", href: "/packages", icon: "map-pin" },
  { title: "Weekend group trips", text: "Join a scheduled departure and travel with new people.", href: "/weekend-trips", icon: "users" },
  { title: "Create your own package", text: "Choose destinations from routes our team can arrange.", href: "/booking?mode=custom", icon: "calendar" },
] as const;

export default function TripChoices() {
  return (
    <nav
      aria-label="Find your next trip"
      className="relative space-y-3 overflow-hidden rounded-[2rem] border border-amber-300/20 bg-slate-950/75 p-4 backdrop-blur-2xl shadow-[0_32px_90px_-20px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-6"
    >
      <div className="luxury-hairline pointer-events-none absolute inset-x-8 top-0" aria-hidden />
      <div className="flex items-center justify-between px-2 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
          Your next getaway
        </p>
        <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
          Curated
        </span>
      </div>
      {choices.map((choice, idx) => (
        <Link
          key={choice.href}
          href={choice.href}
          className="group flex min-h-24 items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white transition-all duration-300 hover:border-amber-400/50 hover:bg-white/[0.08] hover:shadow-[0_12px_32px_-12px_rgba(245,158,11,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300 transition-colors group-hover:border-amber-400/50 group-hover:bg-amber-400/20">
            <Icon name={choice.icon} className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-serif text-xs italic text-amber-300/75">0{idx + 1}</span>
              <span className="font-display text-lg font-semibold tracking-tight">{choice.title}</span>
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-white/70">{choice.text}</span>
          </span>
          <Icon name="arrow-right" className="mt-1 h-4 w-4 shrink-0 text-amber-300 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      ))}
    </nav>
  );
}
