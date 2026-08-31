/**
 * Calm atmospheric backdrop for the authentication shell — the same deep-space
 * palette as the homepage hero, dialled down. CSS only: a layered radial base,
 * two soft colour blooms and a faint grid. No particles, no canvas — a login
 * screen should feel composed, not busy.
 */
export default function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#050914]">
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_-10%,#111f42_0%,#080d1d_45%,#04070f_100%)]" />
      <div className="absolute -left-[10%] top-[-15%] h-[70vh] w-[70vh] rounded-full bg-primary-600/20 blur-[80px] md:blur-[130px]" />
      <div className="absolute right-[-15%] bottom-[-20%] h-[55vh] w-[55vh] rounded-full bg-accent-500/12 blur-[80px] md:blur-[140px]" />
      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(#93c5fd_1px,transparent_1px),linear-gradient(90deg,#93c5fd_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#04070f]" />
    </div>
  );
}
