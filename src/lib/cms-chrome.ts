import { navLinks, footerLinkGroups, socialLinks } from "@/data/navigation";
import { site } from "@/data/site";
import type { IconName, NavLink } from "@/types";
import type { CmsNavItem } from "./server/cms";

export interface CmsChrome {
  header: { appearance: "adaptive" | "solid" | "dark"; brandName: string; brandIcon: IconName; links: NavLink[]; buttonLabel: string; buttonHref: string };
  footer: { appearance: "dark" | "light"; description: string; groups: { title: string; links: NavLink[] }[]; socials: { label: string; href: string; icon: IconName }[] };
}
export function defaultCmsChrome(): CmsChrome {
  return structuredClone({ header: { appearance: "adaptive", brandName: site.name, brandIcon: "bus", links: navLinks, buttonLabel: "", buttonHref: "" }, footer: { appearance: "dark", description: site.description, groups: footerLinkGroups, socials: socialLinks } });
}
/** Manual links retain their order; opted-in published pages append without duplicates. */
export function chromeNavigationLinks(manual: NavLink[], pages: CmsNavItem[] | undefined, location: "header" | "footer"): NavLink[] {
  const seen = new Set<string>();
  return [...manual, ...(pages ?? []).filter(page => page[location])].filter(link => {
    if (seen.has(link.href)) return false;
    seen.add(link.href); return true;
  }).map(({ label, href }) => ({ label, href }));
}

export function chromeFooterGroups(groups: CmsChrome["footer"]["groups"], pages: CmsNavItem[] | undefined): CmsChrome["footer"]["groups"] {
  const manual = new Set(groups.flatMap(group => group.links.map(link => link.href)));
  const extra = chromeNavigationLinks([], pages, "footer").filter(link => !manual.has(link.href));
  if (!groups.length) return extra.length ? [{ title: "Quick Links", links: extra }] : [];
  return groups.map((group, index) => ({ ...group, links: index ? [...group.links] : [...group.links, ...extra] }));
}
