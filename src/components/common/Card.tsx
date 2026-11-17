export interface CardProps {
  children: React.ReactNode;
  /** Adds a hover lift + stronger shadow. Defaults to true. */
  hover?: boolean;
  /** Adds inner padding. Use false when the card holds an edge-to-edge image. */
  padded?: boolean;
  className?: string;
}

/**
 * Base card shell every domain card is built on: rounded corners, soft shadow,
 * white surface and an optional hover lift. Keeps card styling in one place.
 */
export default function Card({
  children,
  hover = true,
  padded = false,
  className = "",
}: CardProps) {
  return (
    <div
      className={`group overflow-hidden rounded-3xl border border-line/80 bg-surface shadow-[0_14px_40px_-18px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] ${
        hover
          ? "transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-400/40 hover:shadow-[0_24px_60px_-16px_rgba(245,158,11,0.16)]"
          : ""
      } ${padded ? "p-6" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
