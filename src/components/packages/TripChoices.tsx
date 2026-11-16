import Link from "next/link";
import Icon from "@/components/common/Icon";

const choices = [
  { title: "Ready-made packages", text: "Explore planned itineraries and see exactly what is included.", href: "/packages", icon: "map-pin" },
  { title: "Weekend group trips", text: "Join a scheduled departure and travel with new people.", href: "/weekend-trips", icon: "users" },
  { title: "Create your own package", text: "Choose destinations from routes our team can arrange.", href: "/booking?mode=custom", icon: "calendar" },
] as const;

export default function TripChoices() {
  return <nav aria-label="Find your next trip" className="space-y-3 rounded-3xl border border-white/15 bg-primary-950/80 p-4 sm:p-6">
    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-widest text-white/60">Your next getaway</p>
    {choices.map(choice => <Link key={choice.href} href={choice.href} className="group flex min-h-24 items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-white transition-colors hover:border-accent-400/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400">
      <Icon name={choice.icon} className="mt-1 h-5 w-5 shrink-0 text-accent-400" />
      <span className="min-w-0 flex-1"><span className="block font-display text-lg font-semibold">{choice.title}</span><span className="mt-1 block text-sm leading-relaxed text-white/70">{choice.text}</span></span>
      <Icon name="arrow-right" className="mt-1 h-4 w-4 shrink-0 text-accent-400" />
    </Link>)}
  </nav>;
}
