import Icon from "@/components/common/Icon";
import type { Feature } from "@/types";

export interface FeatureCardProps {
  feature: Feature;
  dark?: boolean;
}

/**
 * Trust point used on the dark "Why Choose Us" section. Styled for a dark
 * (primary) background — translucent surface with an amber icon.
 */
export default function FeatureCard({ feature, dark = true }: FeatureCardProps) {
  const surface = feature.style === "minimal" ? "border-transparent bg-transparent" : feature.style === "filled" ? (dark ? "border-amber-400/20 bg-white/[0.04]" : "border-primary-100 bg-primary-50") : feature.style === "outlined" ? (dark ? "border-white/25 bg-transparent" : "border-primary-200 bg-transparent") : (dark ? "border-white/10 bg-white/[0.03] hover:border-amber-400/40 hover:bg-white/[0.06]" : "border-line bg-surface hover:border-amber-400/40");
  return (
    <div className={`group rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-18px_rgba(245,158,11,0.18)] motion-reduce:transform-none ${surface}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300 transition-colors group-hover:bg-accent-500 group-hover:text-slate-950">
        <Icon name={feature.icon} className="h-6 w-6" />
      </span>
      <h3 className={`mt-5 font-display text-lg font-semibold ${dark ? "text-white" : "text-fg"}`}>
        {feature.title}
      </h3>
      <p className={`mt-2 text-sm leading-relaxed ${dark ? "text-primary-100" : "text-muted"}`}>
        {feature.description}
      </p>
    </div>
  );
}
