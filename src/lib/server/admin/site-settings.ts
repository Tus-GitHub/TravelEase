import { getPool } from "../db";
import { site } from "@/data/site";
import { invalidateSiteSettings } from "../site-settings";

/** Admin read/write for the `site_settings` key/value store (migration 021). */

const COLUMN_FOR = {
  contactPhone: "contact_phone",
  contactEmail: "contact_email",
  contactAddress: "contact_address",
} as const;
type Field = keyof typeof COLUMN_FOR;

export interface AdminSiteSettings {
  /** Raw stored overrides ("" = not set, falls back to the default). */
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  /** Global vendor commission % (chunk 3.5). "" = not set (treated as 0). */
  vendorCommissionPct: string;
  /** The `src/data/site.ts` values, so the UI can show them as placeholders. */
  defaults: { contactPhone: string; contactEmail: string; contactAddress: string };
}

export async function getAdminSiteSettings(): Promise<AdminSiteSettings> {
  const { rows } = await getPool().query(
    `SELECT setting_key, setting_value FROM site_settings`,
  );
  const map = new Map(rows.map((r) => [r.setting_key as string, (r.setting_value as string) ?? ""]));
  return {
    contactPhone: map.get("contact_phone") ?? "",
    contactEmail: map.get("contact_email") ?? "",
    contactAddress: map.get("contact_address") ?? "",
    vendorCommissionPct: map.get("vendor_commission_pct") ?? "",
    defaults: {
      contactPhone: site.contact.phone,
      contactEmail: site.contact.email,
      contactAddress: site.contact.address,
    },
  };
}

export async function updateSiteSettings(
  input: Partial<Record<Field, string>> & { vendorCommissionPct?: string | number },
  actorId: string,
): Promise<AdminSiteSettings> {
  const writes: [string, string][] = (Object.keys(COLUMN_FOR) as Field[])
    .filter((k) => typeof input[k] === "string")
    .map((k) => [COLUMN_FOR[k], (input[k] as string).trim().slice(0, 300)]);

  if (input.vendorCommissionPct !== undefined && input.vendorCommissionPct !== "") {
    const pct = Math.min(100, Math.max(0, Number(input.vendorCommissionPct)));
    if (Number.isFinite(pct)) writes.push(["vendor_commission_pct", String(pct)]);
  } else if (input.vendorCommissionPct === "") {
    writes.push(["vendor_commission_pct", ""]); // clear -> treated as 0
  }

  for (const [key, value] of writes) {
    await getPool().query(
      `INSERT INTO site_settings (setting_key, setting_value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by`,
      [key, value, actorId],
    );
  }
  invalidateSiteSettings();
  return getAdminSiteSettings();
}
