import { MEALS, type DayExtras } from "@/lib/trip-plan";
export default function DayIncludedDetails({day}:{day:DayExtras}){
  return <div className="mt-3 space-y-2 text-sm text-muted">{(day.meals?.length??0)>0&&<p className="capitalize">Included meals: {MEALS.filter(meal=>day.meals?.includes(meal)).join(", ")}</p>}{day.hotel&&<p>Included stay: {day.hotel.hotelName}{day.hotel.roomType?` · ${day.hotel.roomType}`:""}{day.hotel.notes?` · ${day.hotel.notes}`:""}</p>}</div>;
}
