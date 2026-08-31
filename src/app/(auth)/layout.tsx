import Link from "next/link";
import Logo from "@/components/common/Logo";
import Icon from "@/components/common/Icon";
import AuthBackdrop from "@/components/auth/AuthBackdrop";
import AuthShowcase from "@/components/auth/AuthShowcase";
import AuthCard from "@/components/auth/AuthCard";
import AuthIntro from "@/components/auth/AuthIntro";

/**
 * Full-screen shell for the auth pages — a cinematic, always-dark environment
 * that matches the homepage hero. Asymmetric two-panel on desktop (editorial
 * visual left, form card right); a single centred card on smaller screens.
 * Deliberately excludes the site Navbar/Footer. The `dark` class + dark
 * `color-scheme` scope the design-system tokens so the shared form components
 * render correctly regardless of the visitor's chosen theme; `auth-scope`
 * adds the soft focus glow for inputs on the dark card.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-scope dark relative flex min-h-[100svh] flex-col bg-[#04070f] text-white [color-scheme:dark]">
      <AuthBackdrop />
      <div className="site-grain" aria-hidden />
      <AuthIntro />

      {/* top bar (§12) — subtle, in-flow, never overlaps the card */}
      <header
        data-auth-el="nav"
        className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-8"
      >
        <Logo inverted />
        <Link
          href="/"
          className="hover-underline group inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <Icon
            name="arrow-right"
            className="h-4 w-4 rotate-180 transition-transform duration-200 group-hover:-translate-x-0.5"
          />
          Back to website
        </Link>
      </header>

      {/* composition */}
      <div className="relative z-10 grid flex-1 lg:grid-cols-[1.1fr_1fr]">
        <AuthShowcase />
        <div className="flex items-center justify-center px-5 pb-14 pt-4 sm:px-8 lg:py-14 lg:pr-16 xl:pr-24">
          <div className="w-full max-w-[27rem]">
            <AuthCard>{children}</AuthCard>
          </div>
        </div>
      </div>
    </div>
  );
}
