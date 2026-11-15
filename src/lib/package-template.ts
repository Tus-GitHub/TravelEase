import { indiaDate, TripError, type DepartureInput, type StayInput } from "./weekend-trips";
import { mealSummary } from "./trip-plan";
import type { PackageContent } from "./package-content";
export interface PackageTemplateOption { id: number; name: string; mode: string; days: number; price: number; capacity: number; tripContent?: PackageContent | null; imageUrl?: string }
const dateAfter=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
/** Copies guest promises into a draft only. It never reserves supplier rooms. */
export function applyPackageTemplate(draft: DepartureInput, pkg: PackageTemplateOption): DepartureInput {
  if (!pkg.tripContent || pkg.tripContent.routeTree || !["shared","both"].includes(pkg.mode)) throw new TripError("Choose a fixed Shared or Both package with a reusable day plan.");
  const content=structuredClone(pkg.tripContent), startDate=indiaDate(draft.startsAt), days=content.itinerary.length;
  const candidate=Date.parse(draft.endsAt)+(Date.parse(dateAfter(startDate,days-1))-Date.parse(indiaDate(draft.endsAt)));
  const endsAt=new Date(Math.max(candidate,Date.parse(draft.startsAt)+3600000)).toISOString();
  const stays:StayInput[]=content.itinerary.flatMap((day,i)=>{
    if(!day.hotel)return[];
    const checkIn=dateAfter(startDate,i),checkOut=dateAfter(startDate,i+1);
    return[{hotelName:day.hotel.hotelName,hotelAddress:day.hotel.hotelAddress,cityId:null,imageUrl:"",checkIn,checkOut,roomType:day.hotel.roomType,roomsReserved:0,occupancyPerRoom:2,staffBedsReserved:0,mealPlan:mealSummary({breakfast:content.itinerary[i+1]?.meals?.includes("breakfast")?1:0,lunch:day.meals?.includes("lunch")?1:0,dinner:day.meals?.includes("dinner")?1:0}),confirmationStatus:"pending",supplierReference:"",contactName:"",contactPhone:"",supplierCost:null,publicNotes:day.hotel.notes,privateNotes:""}];
  });
  return {...draft,packageId:pkg.id,title:pkg.name,endsAt,pricePerPerson:pkg.price,capacity:pkg.capacity,minTravellers:Math.min(draft.minTravellers,pkg.capacity),content:{...content,imageUrl:pkg.imageUrl||content.imageUrl,stayNights:stays.map(stay=>stay.checkIn)},stays};
}
