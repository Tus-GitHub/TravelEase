"use client";

import Image from "next/image";
import Icon from "@/components/common/Icon";
import RevealText from "@/components/motion/RevealText";
import type { IconName } from "@/types";

const trust: { icon: IconName; label: string }[] = [
  { icon: "shield-check", label: "Verified chauffeurs" },
  { icon: "map-pin", label: "120+ cities" },
  { icon: "star", label: "4.9 average rating" },
];

/**
 * Left panel of the auth composition (desktop only): a cinematic open-road
 * image graded into the dark shell, with an editorial headline in the
 * foreground. A supporting visual — the form card beside it stays the focus.
 */
export default function AuthShowcase() {
  return (
    <div className="relative hidden overflow-hidden lg:block">
      <div data-auth-el="visual" className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1400&q=80"
          alt=""
          fill
          priority
          sizes="55vw"
          className="object-cover object-center"
        />
      </div>
      {/* grade the photo into the shell — dark on the text side, open on the far edge */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#04070f] via-[#04070f]/85 to-[#04070f]/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#04070f] via-transparent to-[#04070f]/55" />
      <div className="absolute -left-[8%] top-[10%] h-[55vh] w-[55vh] rounded-full bg-primary-600/20 blur-[130px]" />

      {/* foreground copy */}
      <div data-auth-el="headline" className="absolute inset-x-12 bottom-14 xl:inset-x-16">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/50">
          Jagdamba Travellers — Members
        </p>
        <h2 className="mt-5 font-display text-[clamp(2.5rem,4.2vw,3.75rem)] font-extrabold leading-[0.98] tracking-tight">
          <RevealText text={"Your journey\nstarts here."} />
        </h2>

        <div className="mt-6 max-w-md">
          <p className="text-base leading-relaxed text-white/70">
            One account for every trip — chauffeur-driven cars and coaches,
            transparent fares, and your bookings in one place.
          </p>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
            {trust.map((t) => (
              <li key={t.label} className="flex items-center gap-2 text-sm text-white/60">
                <Icon name={t.icon} className="h-4 w-4 text-accent-400" />
                {t.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
