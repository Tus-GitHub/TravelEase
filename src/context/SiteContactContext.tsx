"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { site } from "@/data/site";

/**
 * Client-side access to the (admin-editable) contact details. Starts from the
 * `src/data/site.ts` defaults so there's no layout shift or blank flash, then
 * refreshes from `/api/site-settings` on mount. Server-rendered surfaces
 * (booking emails, the confirm page) read `getSiteSettings()` directly instead.
 */

export type SiteContact = { phone: string; email: string; address: string };

const DEFAULT: SiteContact = {
  phone: site.contact.phone,
  email: site.contact.email,
  address: site.contact.address,
};

const SiteContactContext = createContext<SiteContact>(DEFAULT);

export function SiteContactProvider({ children }: { children: React.ReactNode }) {
  const [contact, setContact] = useState<SiteContact>(DEFAULT);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { contact?: Partial<SiteContact> } | null) => {
        if (cancelled || !d?.contact) return;
        setContact({
          phone: d.contact.phone || DEFAULT.phone,
          email: d.contact.email || DEFAULT.email,
          address: d.contact.address || DEFAULT.address,
        });
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteContactContext.Provider value={contact}>{children}</SiteContactContext.Provider>
  );
}

export function useSiteContact(): SiteContact {
  return useContext(SiteContactContext);
}
