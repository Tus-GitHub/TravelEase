import Image from "next/image";
import SearchForm from "@/components/forms/SearchForm";
import Icon from "@/components/common/Icon";

const stats = [
  { value: "500+", label: "Vehicles" },
  { value: "50K+", label: "Happy Riders" },
  { value: "120+", label: "Cities" },
  { value: "4.9",  label: "Avg. Rating" },
];

/** Floating info badge — pure CSS animation, no JS required. */
function FloatingBadge({
  className,
  floatClass,
  children,
}: {
  className?: string;
  floatClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`absolute hidden lg:flex ${floatClass} ${className ?? ""}`}>
      {children}
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center pt-24 pb-16 overflow-hidden">
      {/* Background image + overlay */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80"
          alt="Scenic open road winding through mountains"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-950/90 via-primary-900/80 to-primary-800/70" />
      </div>

      {/* ── Floating badges (desktop only) ────────────── */}

      {/* Top-right: trending destination */}
      <FloatingBadge
        floatClass="animate-float-a"
        className="right-8 xl:right-20 top-32 flex-col"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white shadow-lg backdrop-blur-md">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500/90 shadow">
            <Icon name="map-pin" className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">
              Trending now
            </p>
            <p className="font-display text-sm font-bold">Manali, HP</p>
          </div>
        </div>
      </FloatingBadge>

      {/* Middle-right: rating */}
      <FloatingBadge
        floatClass="animate-float-b"
        className="right-16 xl:right-36 top-1/2 -translate-y-16"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white shadow-lg backdrop-blur-md">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-700/90 shadow">
            <Icon name="star" className="h-5 w-5 text-accent-400" />
          </span>
          <div>
            <p className="font-display text-sm font-bold">4.9 / 5.0</p>
            <p className="text-[11px] text-white/60">50K+ verified rides</p>
          </div>
        </div>
      </FloatingBadge>

      {/* Bottom-right: group trip badge */}
      <FloatingBadge
        floatClass="animate-float-c"
        className="right-8 xl:right-24 bottom-40"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-accent-500/85 px-4 py-3 text-white shadow-lg backdrop-blur-md">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shadow">
            <Icon name="users" className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="font-display text-sm font-bold">Group Trips</p>
            <p className="text-[11px] text-white/80">Up to 26 seats</p>
          </div>
        </div>
      </FloatingBadge>

      {/* ── Main content ─────────────────────────────── */}
      <div className="section-container w-full">
        <div className="max-w-3xl animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur">
            <Icon name="shield-check" className="h-4 w-4 text-accent-400" />
            Trusted by 50,000+ travellers
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            Book Your Perfect Ride{" "}
            <span className="text-accent-400">For Every Journey</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-primary-100">
            From tempo travellers to luxury cars and airport transfers — compare,
            book and ride with verified drivers across the country in just a few
            clicks.
          </p>
        </div>

        {/* Booking form */}
        <div className="mt-10 animate-fade-up [animation-delay:120ms]">
          <SearchForm />
        </div>

        {/* Stats */}
        <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4 animate-fade-up [animation-delay:240ms]">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="font-display text-2xl font-bold text-white sm:text-3xl">
                {stat.value}
              </dt>
              <dd className="text-sm text-primary-200">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
