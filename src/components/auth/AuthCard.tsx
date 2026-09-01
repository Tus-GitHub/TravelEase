import type { ReactNode } from "react";

/**
 * The authentication surface — a refined translucent panel that reads as part
 * of the Jagdamba Travellers design system: dark tinted glass, hairline border, a soft
 * top highlight, deep shadow, generous padding. Not a floating glass rectangle;
 * not fully transparent. Its entrance is choreographed by <AuthIntro> as part
 * of the page's one coordinated sequence.
 */
export default function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div
      data-auth-el="card"
      className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-7 shadow-[0_40px_120px_-24px_rgba(2,6,20,0.85)] backdrop-blur-xl sm:p-9"
    >
      {/* soft highlight along the top edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {children}
    </div>
  );
}
