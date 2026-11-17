import Card from "@/components/common/Card";
import Avatar from "@/components/common/Avatar";
import Icon from "@/components/common/Icon";
import StarRating from "@/components/common/StarRating";
import type { Testimonial } from "@/types";

export interface TestimonialCardProps {
  testimonial: Testimonial;
}

/** Customer review card with rating, quote and author. */
export default function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <Card hover={false} className="relative flex h-full flex-col p-7">
      <div className="flex items-center justify-between">
        <Icon name="quote" className="h-8 w-8 text-amber-400/75" />
        <StarRating rating={testimonial.rating} />
      </div>
      <p className="mt-5 flex-1 font-serif text-lg italic leading-relaxed text-fg/90">
        “{testimonial.quote}”
      </p>
      <div className="mt-6 flex items-center gap-3 border-t border-line-subtle pt-5">
        <Avatar name={testimonial.name} src={testimonial.avatarUrl} />
        <div>
          <p className="font-semibold text-fg">{testimonial.name}</p>
          <p className="text-sm text-muted">{testimonial.location}</p>
        </div>
      </div>
    </Card>
  );
}
