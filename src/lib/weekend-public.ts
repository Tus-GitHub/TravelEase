import type { DepartureStatus, TripContent } from "./weekend-trips";
export interface PublicTrip {
  id:string; slug:string; title:string; startsAt:string; endsAt:string; status:DepartureStatus;
  pickupCityId:number; pickupCity:string; regionId:number; region:string; pickupAddress:string; returnAddress:string;
  capacity:number; availableSeats:number; confirmedSeats:number; minTravellers:number; pricePerPerson:number; taxPercent:number;
  bookingOpensAt:string; bookingClosesAt:string; decisionDeadline:string; paymentHoldMinutes:number; bookable:boolean;
  isFeatured:boolean; content:TripContent;
  guide:{name:string;imageUrl:string;bio:string;languages:string[]} | null;
  vehicleName:string; driverName:string;
  stays:{hotelName:string;hotelAddress:string;imageUrl:string;checkIn:string;checkOut:string;roomType:string;occupancyPerRoom:number;mealPlan:string;publicNotes:string}[];
  cancellationPolicy:string;
}
export interface TripFilters { cityId?:number;regionId?:number;from?:string;to?:string;minPrice?:number;maxPrice?:number;seats?:number;featured?:boolean;sort?:"date"|"price-low"|"price-high" }
