import type { NavLink } from "@/types";
import type { CmsNavItem } from "./server/cms";

export function cmsNavigationLinks(base: NavLink[], cms: CmsNavItem[] | undefined, location: "header" | "footer"): NavLink[] {
  if (!cms) return base;
  const fixed = base.map((link, index) => ({ ...link, order: index * 10 })).filter(link => !["/", "/about"].includes(link.href));
  const links = [...fixed, ...cms.filter(link => link[location]).map(({ href, label, order }) => ({ href, label, order }))];
  return links.sort((a, b) => a.order - b.order).map(({ href, label }) => ({ href, label }));
}
