"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/common/Icon";
import type { SectionProps } from "@/components/common/Section";
import type { IconName } from "@/types";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/profile", label: "My account", icon: "user" },
  { href: "/profile/bookings", label: "My bookings", icon: "calendar" },
  { href: "/profile/saved", label: "Saved trips", icon: "bookmark" },
  { href: "/profile/support", label: "Help & support", icon: "chat" },
];
export default function AccountSection({ title, subtitle, children }: SectionProps) {
  const pathname = usePathname();
  const active = links.find(l => l.href !== "/profile" && pathname.startsWith(l.href))?.href ?? "/profile";
  return <section className="bg-surface-muted pb-10 pt-28 sm:pb-14 sm:pt-32">
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <header className="relative mb-5 overflow-hidden rounded-3xl border border-primary-800 bg-primary-950 p-6 text-white sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[32px] border-white/5" />
        <div className="relative">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-accent-300">Jagdamba Travellers · Your journeys</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{title || (active === "/profile/bookings" ? "Your booking" : "Your support ticket")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">{subtitle || "Your travel plans, personal details and support, all in one place."}</p>
        </div>
      </header>
      <nav aria-label="Your account" className="mb-7 grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-surface p-1.5 sm:grid-cols-4">
        {links.map(link => <Link key={link.href} href={link.href} aria-current={active === link.href ? "page" : undefined} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 sm:text-sm ${active === link.href ? "bg-primary-950 text-accent-300 shadow-sm" : "text-muted hover:bg-surface-hover hover:text-fg"}`}><Icon name={link.icon} className="h-4 w-4" />{link.label}</Link>)}
      </nav>
      {children}
    </div>
  </section>;
}
