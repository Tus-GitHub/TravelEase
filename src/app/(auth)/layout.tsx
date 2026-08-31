import Image from "next/image";
import Logo from "@/components/common/Logo";
import ThemeToggle from "@/components/common/ThemeToggle";

/**
 * Full-screen shell for auth pages: form on the left, brand image on the
 * right. Deliberately excludes the Navbar/Footer used by `(site)` pages.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-canvas lg:grid-cols-2">
      <div className="relative flex items-center justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <Logo />
          <div className="mt-10">{children}</div>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <Image
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=80"
          alt="Scenic desert road at dusk"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-950/85 via-primary-900/30 to-transparent" />
        <div className="absolute inset-x-12 bottom-14 text-white">
          <p className="text-2xl font-bold leading-snug">
            Book Your Perfect Ride For Every Journey
          </p>
          <p className="mt-3 text-white/80">
            Join 50,000+ travellers who trust TravelEase for comfortable,
            verified rides across the country.
          </p>
        </div>
      </div>
    </div>
  );
}
