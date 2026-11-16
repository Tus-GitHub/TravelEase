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
  const surface = feature.style === "minimal" ? "border-transparent bg-transparent" : feature.style === "filled" ? (dark ? "border-primary-700 bg-primary-800" : "border-primary-100 bg-primary-50") : feature.style === "outlined" ? (dark ? "border-white/30 bg-transparent" : "border-primary-200 bg-transparent") : (dark ? "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10" : "border-line bg-surface hover:border-primary-200");
  return (
    <div className={`group rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1.5 motion-reduce:transform-none ${surface}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 transition-colors group-hover:bg-accent-500 group-hover:text-white">
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
