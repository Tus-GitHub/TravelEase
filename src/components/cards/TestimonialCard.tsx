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
    <Card hover={false} className="flex h-full flex-col p-6">
      <Icon name="quote" className="h-9 w-9 text-accent-400" />
      <StarRating rating={testimonial.rating} className="mt-4" />
      <p className="mt-4 flex-1 leading-relaxed text-slate-600">
        “{testimonial.quote}”
      </p>
      <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
        <Avatar name={testimonial.name} src={testimonial.avatarUrl} />
        <div>
          <p className="font-semibold text-slate-900">{testimonial.name}</p>
          <p className="text-sm text-slate-500">{testimonial.location}</p>
        </div>
      </div>
    </Card>
  );
}
