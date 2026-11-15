import test from "node:test";
import assert from "node:assert/strict";
import { draftTrip } from "./weekend-trips.test.ts";
import { validateDeparture, type DepartureInput } from "../../src/lib/weekend-trips";
import { blankPackageContent } from "../../src/lib/package-content";
import { applyPackageTemplate, type PackageTemplateOption } from "../../src/lib/package-template";
import { assertTripReady } from "../../src/lib/server/weekend-trips";
import { createSharedBooking } from "../../src/lib/server/weekend-bookings";
const template = (): PackageTemplateOption => ({ id: 7, name: "Two-day hill weekend", mode: "both", days: 2, price: 3500, capacity: 6,
  imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b", tripContent: { ...blankPackageContent(), summary: "Meet and explore", description: "A shared hill trip", guideIncluded: true, inclusions: ["Transport", "Stay", "Stated meals", "Guide"], exclusions: ["Optional activities"], itinerary: [
    { day: 1, title: "Delhi to Dehradun", description: "Meet and drive", meals: ["dinner"], hotel: { hotelName: "Hill stay", hotelAddress: "Dehradun", roomType: "Twin sharing", notes: "Guest-facing notes" } },
    { day: 2, title: "Chakrata and home", description: "Breakfast, explore and return", meals: ["breakfast"] },
  ] } });
test("a fixed package becomes a dated draft with pending hotel rooms and counted meals, never a supplier reservation", () => {
  const base = validateDeparture(draftTrip()), pkg = template(), result = applyPackageTemplate(base,pkg);
  assert.equal(result.packageId,7); assert.equal(result.title,pkg.name); assert.equal(result.pricePerPerson,3500); assert.equal(result.capacity,6);
  assert.equal(result.endsAt,"2026-11-14T16:30:00.000Z"); assert.deepEqual(result.content.stayNights,["2026-11-13"]);
  assert.equal(result.stays.length,1); assert.equal(result.stays[0].checkOut,"2026-11-14"); assert.equal(result.stays[0].confirmationStatus,"pending"); assert.equal(result.stays[0].roomsReserved,0);
  assert.equal(result.stays[0].supplierCost,null); assert.equal(result.stays[0].supplierReference,""); assert.equal(result.stays[0].contactPhone,""); assert.match(result.stays[0].mealPlan,/1 breakfast/); assert.match(result.stays[0].mealPlan,/1 dinner/);
  result.content.itinerary[0].title="Changed draft"; assert.equal(pkg.tripContent!.itinerary[0].title,"Delhi to Dehradun");
});
test("private guided route plans cannot be copied into one shared group's fixed departure", () => {
  assert.throws(()=>applyPackageTemplate(validateDeparture(draftTrip()),{...template(),mode:"private"}));
  assert.throws(()=>applyPackageTemplate(validateDeparture(draftTrip()),{...template(),tripContent:null}));
});
test("hotel promises in the day plan automatically require beds even if the caller omits explicit hotel nights", () => {
  const result=applyPackageTemplate(validateDeparture(draftTrip()),template());
  const normalized=validateDeparture({...result,bookingClosesAt:"2027-11-12T12:00:00.000Z",decisionDeadline:"2027-11-11T12:00:00.000Z",startsAt:"2027-11-12T16:30:00.000Z",endsAt:"2027-11-13T16:30:00.000Z",content:{...result.content,stayNights:[]},stays:[]});
  assert.deepEqual(normalized.content.stayNights,["2027-11-12"]);
  assert.throws(()=>assertTripReady(normalized as unknown as Parameters<typeof assertTripReady>[0]),/hotel beds/);
  assert.throws(()=>validateDeparture({...normalized,endsAt:normalized.startsAt}));
});
test("shared lead and optional traveller phones are validated before any database/provider access", async () => {
  const raw={departureId:"00000000-0000-4000-8000-000000000001",clientRequestId:"00000000-0000-4000-8000-000000000002",passengerCount:1,passengers:[{name:"Lead",phone:"abc"}]};
  const user={id:"00000000-0000-4000-8000-000000000003",name:"Lead",email:"lead@example.invalid",phone:"",role:"customer",emailVerified:true,createdAt:new Date().toISOString()};
  await assert.rejects(()=>createSharedBooking(raw,user),/valid contact number/);
  await assert.rejects(()=>createSharedBooking({...raw,passengerCount:2,passengers:[{name:"Lead",phone:"9999999999"},{name:"Guest",phone:"bad"}]},user),/contact numbers/);
});
