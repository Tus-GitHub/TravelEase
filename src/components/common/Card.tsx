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
      className={`group overflow-hidden rounded-2xl bg-white shadow-card ${
        hover
          ? "transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card-hover"
          : ""
      } ${padded ? "p-6" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
