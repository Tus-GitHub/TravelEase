import Image from "next/image";
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
      className="relative overflow-hidden rounded-[2rem] border border-amber-500/25 bg-white/95 backdrop-blur-2xl shadow-[0_28px_80px_-20px_rgba(15,23,42,0.16)] dark:border-amber-300/25 dark:bg-slate-950/80 dark:shadow-[0_36px_100px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.14)]"
    >
      <div className="luxury-hairline pointer-events-none absolute inset-x-10 top-0 z-20" aria-hidden />

      {/* Panoramic luxury destination header */}
      <div className="relative h-40 w-full overflow-hidden sm:h-44">
        <Image
          src="/images/destinations/agra-taj-mahal-c6e0bd38.webp"
          alt="Taj Mahal at sunrise — bespoke chauffeur journeys across India"
          fill
          priority
          sizes="(max-width:1024px) 100vw, 45vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/20" />
        <div className="absolute inset-x-5 bottom-3.5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300/90">
              Your next getaway
            </p>
            <p className="mt-0.5 font-serif text-xl italic text-white">
              Handcrafted journeys across India
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-amber-400/35 bg-slate-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200 backdrop-blur-md">
            Concierge
          </span>
        </div>
      </div>

      {/* Interactive journey modes */}
      <div className="space-y-2.5 p-4 sm:p-5">
        {choices.map((choice, idx) => (
          <Link
            key={choice.href}
            href={choice.href}
            className="group flex items-center gap-4 rounded-2xl border border-line bg-surface-muted/70 p-3.5 text-fg transition-all duration-300 hover:border-amber-500/60 hover:bg-amber-50/70 hover:shadow-[0_12px_32px_-12px_rgba(245,158,11,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:border-amber-400/55 dark:hover:bg-white/[0.09] sm:p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 transition-colors group-hover:border-amber-500/60 group-hover:bg-amber-500/20 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
              <Icon name={choice.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-serif text-xs italic text-amber-600 dark:text-amber-300/80">0{idx + 1}</span>
                <span className="font-display text-base font-semibold tracking-tight sm:text-lg">{choice.title}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted dark:text-white/70 sm:text-sm">{choice.text}</span>
            </span>
            <Icon name="arrow-right" className="h-4 w-4 shrink-0 text-amber-600 transition-transform duration-300 group-hover:translate-x-1 dark:text-amber-300" />
          </Link>
        ))}
      </div>
    </nav>
  );
}
