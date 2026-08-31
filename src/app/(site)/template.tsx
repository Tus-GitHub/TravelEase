"use client";

import { usePathname } from "next/navigation";

/**
 * Contextual route-enter transition for the marketing pages — a quick clip +
 * lift rather than a generic crossfade. Keyed on the pathname so it replays on
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
