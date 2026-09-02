import { getPool } from "./db";
import { site } from "@/data/site";

/**
 * Runtime-editable brand/contact details (migration 021, `site_settings`).
 * A row's empty/missing value falls back to `src/data/site.ts`, which stays the
 * source of defaults. Admin edits go through `admin/site-settings.ts`, which
 * calls `invalidateSiteSettings()` so the short cache here doesn't serve stale
 * values.
 */

export interface SiteContact {
  phone: string;
  email: string;
  address: string;
}
export interface SiteSettings {
  contact: SiteContact;
}

const KEYS = ["contact_phone", "contact_email", "contact_address"] as const;

function staticDefaults(): SiteSettings {
  return {
    contact: {
      phone: site.contact.phone,
      email: site.contact.email,
      address: site.contact.address,
    },
  };
}

let cache: { value: SiteSettings; at: number } | null = null;
const TTL_MS = 60_000;

export function invalidateSiteSettings(): void {
  cache = null;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const defaults = staticDefaults();
  try {
    const { rows } = await getPool().query(
      `SELECT setting_key, setting_value FROM site_settings WHERE setting_key = ANY($1)`,
      [KEYS as unknown as string[]],
    );
    const map = new Map(
      rows.map((r) => [r.setting_key as string, ((r.setting_value as string) ?? "").trim()]),
    );
    const pick = (key: string, fallback: string) => {
      const v = map.get(key);
      return v ? v : fallback;
    };
    const value: SiteSettings = {
      contact: {
        phone: pick("contact_phone", defaults.contact.phone),
        email: pick("contact_email", defaults.contact.email),
        address: pick("contact_address", defaults.contact.address),
      },
    };
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.error("getSiteSettings: using static defaults", err);
    return defaults;
  }
}
