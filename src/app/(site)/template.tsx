"use client";

import { usePathname } from "next/navigation";

/**
 * Short route-enter lift for the marketing pages, with content always visible.
 * Keyed on the pathname so it replays on
 * every navigation. Pure CSS (`.route-enter` in globals.css) so there's no
 * SSR/client branching to break hydration; disabled under prefers-reduced-motion.
 * (Full shared-element morphs, e.g. a vehicle image expanding into its detail
 * page, are a deeper follow-up.)
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-enter">
      {children}
    </div>
  );
}
