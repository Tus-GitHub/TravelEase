"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { chromeFooterGroups, type CmsChrome } from "@/lib/cms-chrome";
import Logo from "@/components/common/Logo";
import Icon from "@/components/common/Icon";
import { site } from "@/data/site";
import { useSiteContact } from "@/context/SiteContactContext";
import { footerLinkGroups, socialLinks } from "@/data/navigation";
import type { IconName } from "@/types";
import { cmsNavigationLinks } from "@/lib/cms-navigation";
import type { CmsNavItem } from "@/lib/server/cms";

export default function Footer({ cmsNavigation, chrome }: { cmsNavigation?: CmsNavItem[]; chrome?: CmsChrome } = {}) {
  const settings = chrome?.footer, dark = settings?.appearance !== "light";
  const colors = { "--footer-background": dark ? "#060912" : "#faf8f4", "--footer-muted": dark ? "rgb(255 255 255 / .65)" : "#475569", "--footer-strong": dark ? "#ffffff" : "#0f172a", "--footer-border": dark ? "rgb(245 158 11 / .18)" : "#e2dcd0", "--footer-panel": dark ? "rgb(255 255 255 / .05)" : "#ece7dd" } as CSSProperties;
  const groups = settings ? chromeFooterGroups(settings.groups, cmsNavigation) : footerLinkGroups.map((group, index) => index === 0 ? { ...group, links: cmsNavigationLinks(group.links, cmsNavigation, "footer") } : group);
  const socials = settings?.socials ?? socialLinks;
  const contact = useSiteContact();
  const contactItems: { icon: IconName; value: string; href?: string }[] = [
    { icon: "phone", value: contact.phone, href: `tel:${contact.phone.replace(/\s+/g, "")}` },
    { icon: "mail", value: contact.email, href: `mailto:${contact.email}` },
    { icon: "location", value: contact.address },
  ];

  return (
    <footer style={colors} className="border-t border-[var(--footer-border)] bg-[var(--footer-background)] text-[var(--footer-muted)]">
      <div className="section-container py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-3 lg:grid-cols-5">
          {/* Brand + socials */}
          <div className="col-span-2">
            <Logo inverted={dark} lightSurface={!dark} label={chrome?.header.brandName} icon={chrome?.header.brandIcon} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--footer-muted)]">
              {settings?.description ?? site.description}
            </p>
            <Link href="/install" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-[var(--footer-border)] px-4 py-2 text-sm font-semibold text-[var(--footer-strong)] hover:bg-[var(--footer-panel)]">Add to home screen</Link>
            <div className="mt-6 flex gap-3">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--footer-panel)] text-[var(--footer-muted)] transition-colors hover:bg-accent-500 hover:text-[var(--footer-strong)]"
                >
                  <Icon name={social.icon} className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--footer-strong)]">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="hover-underline text-sm text-[var(--footer-muted)] transition-colors hover:text-accent-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact row */}
        <div className="mt-12 grid gap-4 border-t border-[var(--footer-border)] pt-8 sm:grid-cols-3">
          {contactItems.map((item) => (
            <div key={item.value} className="flex items-start gap-3 text-sm">
              <Icon name={item.icon} className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />
              {item.href ? (
                <a href={item.href} className="text-[var(--footer-muted)] hover:text-accent-400">
                  {item.value}
                </a>
              ) : (
                <span className="text-[var(--footer-muted)]">{item.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--footer-border)]">
        <div className="section-container flex flex-col items-center justify-between gap-3 py-5 text-sm text-[var(--footer-muted)] sm:flex-row">
          <p>
            © {new Date().getFullYear()} {chrome?.header.brandName ?? site.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link href="/image-credits" className="hover:text-accent-400">Photo credits</Link>
            <Link href="/privacy" className="hover:text-accent-400">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-accent-400">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
