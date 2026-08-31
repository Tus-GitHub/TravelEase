import Icon from "./Icon";

export interface StarRatingProps {
  /** Rating from 0–5; halves are rounded for the filled count. */
  rating: number;
  className?: string;
  /** Show the numeric value next to the stars. */
  showValue?: boolean;
}

/** Renders five stars, filling amber up to the (rounded) rating. */
export default function StarRating({
  rating,
  className = "",
  showValue = false,
}: StarRatingProps) {
  const filled = Math.round(rating);

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon
          key={i}
          name="star"
          className={`h-4 w-4 ${
            i < filled ? "fill-accent-500 text-accent-500" : "text-faint"
          }`}
        />
      ))}
      {showValue && (
        <span className="ml-1 text-sm font-semibold text-fg">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
