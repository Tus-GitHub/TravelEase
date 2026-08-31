import Link from "next/link";
import Logo from "@/components/common/Logo";
import Icon from "@/components/common/Icon";
import { site } from "@/data/site";
import { footerLinkGroups, socialLinks } from "@/data/navigation";
import type { IconName } from "@/types";

const contactItems: { icon: IconName; value: string; href?: string }[] = [
  { icon: "phone", value: site.contact.phone, href: `tel:${site.contact.phone}` },
  { icon: "mail", value: site.contact.email, href: `mailto:${site.contact.email}` },
  { icon: "location", value: site.contact.address },
];

export default function Footer() {
  return (
    <footer className="bg-primary-950 text-white/55">
      <div className="section-container py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-3 lg:grid-cols-5">
          {/* Brand + socials */}
          <div className="col-span-2">
            <Logo inverted />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
              {site.description}
            </p>
            <div className="mt-6 flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/55 transition-colors hover:bg-accent-500 hover:text-white"
                >
                  <Icon name={social.icon} className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="hover-underline text-sm text-white/55 transition-colors hover:text-accent-400"
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
        <div className="mt-12 grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-3">
          {contactItems.map((item) => (
            <div key={item.value} className="flex items-start gap-3 text-sm">
              <Icon name={item.icon} className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />
              {item.href ? (
                <a href={item.href} className="text-white/55 hover:text-accent-400">
                  {item.value}
                </a>
              ) : (
                <span className="text-white/55">{item.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="section-container flex flex-col items-center justify-between gap-3 py-5 text-sm text-white/45 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <div className="flex gap-5">
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
