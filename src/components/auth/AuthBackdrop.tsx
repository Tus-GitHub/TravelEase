import Image from "next/image";

/**
 * Atmospheric background for the auth shell (§11 / §13). Layered and mostly
 * static: a radial base, two soft colour blooms, a faint grid, a bottom
 * vignette, one very slow faint aurora. Below `lg` — where the split-screen
 * visual is gone — a heavily darkened, blurred sliver of the same travel photo
 * bleeds in behind the card so the mobile screen still reads as *travel*,
 * without an image to scroll past. No neon, no flashing; the reduced-motion
 * net freezes the aurora, and its drift is desktop-only anyway.
 */
export default function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#04070f]">
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_-10%,#111f42_0%,#080d1d_45%,#04070f_100%)]" />

      {/* mobile-only whisper of the travel photo */}
      <div className="absolute inset-x-0 top-0 h-[52%] opacity-[0.16] blur-sm lg:hidden">
        <Image
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=60"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#04070f]/40 via-[#04070f]/85 to-[#04070f] lg:hidden" />

      <div data-auth-el="aurora" className="auth-aurora" />
      <div className="absolute -left-[10%] top-[-15%] h-[70vh] w-[70vh] rounded-full bg-primary-600/18 blur-[70px] md:blur-[130px]" />
      <div className="absolute right-[-15%] bottom-[-20%] h-[55vh] w-[55vh] rounded-full bg-accent-500/10 blur-[70px] md:blur-[140px]" />
      <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(#93c5fd_1px,transparent_1px),linear-gradient(90deg,#93c5fd_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#04070f]" />
    </div>
  );
}
