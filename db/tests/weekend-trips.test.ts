import assert from "node:assert/strict";
import { calculatePrice, type PricingRuleInput } from "../../src/lib/server/pricing.ts";
import test from "node:test";
import { validateDeparture, validateStay, hotelCapacity, indiaDate, fromIndiaInput, validateGuide } from "../../src/lib/weekend-trips.ts";
test("inclusive shared prices preserve the advertised total without seasonal or double tax", () => {
  const rule: PricingRuleInput = {baseAmount:500,perKmRate:20,perHourRate:100,includedKm:0,extraKmRate:20,perDayRate:1000,driverAllowancePerDay:500,nightCharge:300,flatRate:0,taxPercent:5,minHours:null,minKm:null};
  for (const [rate,quantity,tax] of [[4999,3,5],[99.99,7,18],[.01,3,0],[100,1,100]]) {
    const price = calculatePrice({bookingType:"package",packagePricePerPerson:rate,passengers:quantity,packagePriceIncludesTax:true,seasonalMultiplier:2,discountAmount:999}, {...rule,taxPercent:tax});
    assert.equal(price.totalAmount,Math.round(rate*quantity*100)/100);
    assert.equal(Math.round((price.subtotal+price.taxAmount)*100),Math.round(price.totalAmount*100));
    assert.equal(price.seasonalAdjustment,0); assert.equal(price.discountAmount,0);
  }
});
export function draftTrip() { return {
  packageId: 1, slug: "friday-together", title: "Friday together", startsAt: "2026-11-13T16:30:00.000Z", endsAt: "2026-11-15T16:30:00.000Z", pickupCityId: 1, pickupAddress: "Main station", returnAddress: "Main station", vehicleId: 1, driverId: 1, guideId: 1,
  capacity: 10, staffReservedSeats: 1, minTravellers: 5, pricePerPerson: 4999, taxPercent: 5, bookingOpensAt: "2026-11-06T00:00:00.000Z", bookingClosesAt: "2026-11-12T12:00:00.000Z", decisionDeadline: "2026-11-11T12:00:00.000Z", paymentHoldMinutes: 120,
  content: { summary: "Meet your group", description: "An inclusive weekend", imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b", imageAlt: "Mountain view", itinerary: [{ day: 1, title: "Meet", description: "Evening pickup" }], inclusions: ["Transport", "Guide", "Hotel"], exclusions: ["Personal purchases"], stayNights: ["2026-11-14"] }, privateNotes: "", isFeatured: false, displayOrder: 0,
  stays: [{ hotelName: "Test hotel", hotelAddress: "Main road", cityId: null, imageUrl: "", checkIn: "2026-11-14", checkOut: "2026-11-15", roomType: "Twin", roomsReserved: 6, occupancyPerRoom: 2, staffBedsReserved: 2, mealPlan: "Breakfast", confirmationStatus: "confirmed", supplierReference: "", contactName: "", contactPhone: "", supplierCost: 9000, publicNotes: "", privateNotes: "" }]
}; }
test("Friday means India time, including a Thursday UTC timestamp", () => {
  const draft = draftTrip(); draft.startsAt = "2026-11-12T20:00:00.000Z"; draft.bookingClosesAt = "2026-11-12T12:00:00.000Z";
  assert.equal(indiaDate(validateDeparture(draft).startsAt), "2026-11-13");
  assert.equal(fromIndiaInput("2026-11-13T01:30"), draft.startsAt);
  assert.throws(() => validateDeparture({ ...draft, startsAt: "2026-11-12T12:30:00Z" }), /Friday/);
});
test("booking decisions and cutoffs must precede the departure", () => {
  const draft = draftTrip();
  for (const changes of [{ endsAt: draft.startsAt }, { bookingClosesAt: draft.startsAt }, { decisionDeadline: draft.startsAt }, { bookingOpensAt: draft.decisionDeadline }]) assert.throws(() => validateDeparture({ ...draft, ...changes }));
  assert.throws(() => validateDeparture({ ...draft, startsAt: "2026-02-30T10:00:00Z" }), /invalid/);
});
test("seat quantities, price precision and hold duration reject unsafe values", () => {
  const draft = draftTrip();
  for (const changes of [{ capacity: 0 }, { capacity: 1.5 }, { capacity: 1001 }, { minTravellers: 11 }, { pricePerPerson: -1 }, { pricePerPerson: 1.001 }, { pricePerPerson: "4999" }, { taxPercent: 101 }, { paymentHoldMinutes: 0 }, { paymentHoldMinutes: 1441 }]) assert.throws(() => validateDeparture({ ...draft, ...changes }));
});
test("hotel capacity is the least confirmed customer bed count across every included night", () => {
  const stay = validateStay(draftTrip().stays[0]);
  assert.equal(hotelCapacity(["2026-11-14"], [stay]), 10);
  assert.equal(hotelCapacity(["2026-11-13", "2026-11-14"], [stay]), 0);
  assert.equal(hotelCapacity(["2026-11-14"], [{ ...stay, confirmationStatus: "pending" }]), 0);
  assert.equal(hotelCapacity(["2026-11-14"], [{ ...stay, roomsReserved: 1, staffBedsReserved: 3 }]), 0);
  assert.equal(hotelCapacity([], []), Infinity);
});
test("hotel dates cannot leave the agreed travel window or repeat another stay", () => {
  const draft = draftTrip();
  assert.throws(() => validateDeparture({ ...draft, stays: [{ ...draft.stays[0], checkOut: "2026-11-16" }] }), /within/);
  assert.throws(() => validateDeparture({ ...draft, content: { ...draft.content, stayNights: ["2026-11-15"] } }), /within/);
  assert.throws(() => validateStay({ ...draft.stays[0], occupancyPerRoom: 0 }));
});
test("descriptive content rejects unsafe images and malformed structures", () => {
  const draft = draftTrip();
  for (const imageUrl of ["javascript:alert(1)", "http://images.unsplash.com/x", "https://attacker.invalid/image.jpg"]) assert.throws(() => validateDeparture({ ...draft, content: { ...draft.content, imageUrl } }));
  for (const value of [null, [], "trip"]) assert.throws(() => validateDeparture(value));
  assert.throws(() => validateDeparture({ ...draft, slug: "../admin" }));
  assert.throws(() => validateDeparture({ ...draft, content: { ...draft.content, itinerary: [] } }));
});
test("guide rosters validate fields without implying a login account", () => {
  const guide = validateGuide({ name: "Guide", phone: "+91 00000 00000", imageUrl: "", bio: "Meet your guide", languages: ["Hindi", "English"], privateNotes: "Internal", isActive: true });
  assert.equal(guide.name, "Guide"); assert(!("role" in guide));
  assert.throws(() => validateGuide({ ...guide, languages: "Hindi" }));
  assert.throws(() => validateGuide({ ...guide, imageUrl: "https://attacker.invalid/photo.jpg" }));
});
