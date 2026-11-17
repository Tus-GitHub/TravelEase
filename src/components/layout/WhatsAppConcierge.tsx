"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/common/Icon";
import { useSiteContact } from "@/context/SiteContactContext";

function toWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export default function WhatsAppConcierge() {
  const [open, setOpen] = useState(false);
  const contact = useSiteContact();
  const waDigits = toWhatsAppDigits(contact.phone || "");
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent("Hi Jagdamba Travellers, I'd like help planning a trip.")}`
    : "/contact";

  return (
    <div
      className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2.5"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", paddingRight: "env(safe-area-inset-right)" }}
    >
      {open && (
        <div
          role="dialog"
          aria-label="Travel concierge options"
          className="w-72 overflow-hidden rounded-3xl border border-amber-400/30 bg-[#070b14]/95 p-4 text-white shadow-[0_24px_70px_-15px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
        >
          <div className="luxury-hairline pointer-events-none mb-3" aria-hidden />
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-amber-300">
                24/7 Concierge
              </p>
              <p className="mt-0.5 font-serif text-base italic text-white">
                How can we help?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close concierge menu"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3.5 space-y-2">
            <a
              href={waHref}
              target={waDigits ? "_blank" : undefined}
              rel={waDigits ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25"
            >
              <Icon name="chat" className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Chat on WhatsApp</span>
            </a>

            {contact.phone && (
              <a
                href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm font-medium text-white/90 transition-colors hover:border-amber-400/40 hover:bg-white/[0.08]"
              >
                <Icon name="phone" className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Call {contact.phone}</span>
              </a>
            )}

            <Link
              href="/booking?mode=custom"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm font-medium text-white/90 transition-colors hover:border-amber-400/40 hover:bg-white/[0.08]"
            >
              <Icon name="map-pin" className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Build a custom route</span>
            </Link>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open travel concierge"
        className="group inline-flex min-h-12 items-center gap-2.5 rounded-full border border-amber-400/40 bg-[#070b14]/90 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_45px_-12px_rgba(0,0,0,0.85),0_0_24px_-6px_rgba(245,158,11,0.35)] backdrop-blur-xl transition-all hover:scale-[1.03] hover:border-amber-400"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/20 text-amber-300">
          <Icon name={open ? "close" : "chat"} className="h-4 w-4" />
        </span>
        <span className="hidden sm:inline">Concierge</span>
      </button>
    </div>
  );
}
