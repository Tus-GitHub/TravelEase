import Icon from "@/components/common/Icon";
import type { Feature } from "@/types";

export interface FeatureCardProps {
  feature: Feature;
}

/**
 * Trust point used on the dark "Why Choose Us" section. Styled for a dark
 * (primary) background — translucent surface with an amber icon.
 */
export default function FeatureCard({ feature }: FeatureCardProps) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/20 hover:bg-white/10">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 transition-colors group-hover:bg-accent-500 group-hover:text-white">
        <Icon name={feature.icon} className="h-6 w-6" />
      </span>
      <h3 className="mt-5 font-display text-lg font-semibold text-white">
        {feature.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-primary-100">
        {feature.description}
      </p>
    </div>
  );
}
