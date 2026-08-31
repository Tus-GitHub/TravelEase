/**
 * Atmospheric background for the auth shell (§11). Layered and mostly static:
 * a radial base, two soft colour blooms, a faint grid, a bottom vignette — plus
 * one very slow, very faint aurora. No neon, no flashing, no constant busy
 * motion; it should make the page feel alive without pulling the eye off the
 * form. The reduced-motion net freezes the aurora.
 */
export default function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#04070f]">
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_-10%,#111f42_0%,#080d1d_45%,#04070f_100%)]" />
      <div data-auth-el="aurora" className="auth-aurora" />
      <div className="absolute -left-[10%] top-[-15%] h-[70vh] w-[70vh] rounded-full bg-primary-600/18 blur-[80px] md:blur-[130px]" />
      <div className="absolute right-[-15%] bottom-[-20%] h-[55vh] w-[55vh] rounded-full bg-accent-500/10 blur-[80px] md:blur-[140px]" />
      <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(#93c5fd_1px,transparent_1px),linear-gradient(90deg,#93c5fd_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#04070f]" />
    </div>
  );
}
