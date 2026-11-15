import test from "node:test";
import assert from "node:assert/strict";
import { bookingContact } from "../../src/lib/booking-contact.ts";

test("missing OAuth profile phone is collected as the booking lead's contact",()=>{
  const owner={name:"Customer",phone:""};
  assert.throws(()=>bookingContact(undefined,owner),/contact number/);
  assert.deepEqual(bookingContact([{name:"Customer",phone:"+91 98765 43210",isPrimary:true}],owner),{name:"Customer",phone:"+919876543210",isPrimary:true});
  assert.equal(owner.phone,"");
});
test("saved contact is reused without extra input and an explicit valid booking number can override it",()=>{
  const owner={name:"Customer",phone:"9876543210"};
  assert.equal(bookingContact(undefined,owner).phone,owner.phone);
  assert.equal(bookingContact([{name:"Lead",phone:"9123456780",isPrimary:true}],owner).phone,"9123456780");
  assert.equal(owner.phone,"9876543210");
});
test("invalid contacts cannot be submitted even when a profile has a valid fallback",()=>{
  const owner={name:"Customer",phone:"9876543210"};
  for(const phone of ["123","phone@example.com","9876543210\r\nBcc: x","9".repeat(31)])assert.throws(()=>bookingContact([{phone}],owner));
});
