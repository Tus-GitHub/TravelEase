import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserById, toPublicUser, updateUser } from "@/lib/server/users";
import { getUserIdForToken, SESSION_COOKIE } from "@/lib/server/session";
import {
  getCustomerProfile,
  upsertCustomerProfile,
  type CustomerProfile,
} from "@/lib/server/customer-profile";
import { isValidPhone, isValidPincode, isValidLatLng } from "@/lib/validation";
import { isValidTravelTag } from "@/lib/travelTags";

const EMPTY_PROFILE: CustomerProfile = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  latitude: null,
  longitude: null,
  preferredTags: [],
};

async function currentUserId(): Promise<string | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return getUserIdForToken(token);
}

const unauthorized = () =>
  NextResponse.json({ error: "Not authenticated." }, { status: 401 });

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const row = await findUserById(userId);
  if (!row) return unauthorized();

  const user = toPublicUser(row);
  const profile = user.role === "customer" ? await getCustomerProfile(userId) : null;
  return NextResponse.json({ user, profile });
}

interface ProfilePatchBody {
  name?: string;
  phone?: string;
  profile?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number | null;
    longitude?: number | null;
    preferredTags?: unknown;
  };
}

export async function PATCH(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const existing = await findUserById(userId);
  if (!existing) return unauthorized();
  const current = toPublicUser(existing);

  let body: ProfilePatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // --- account fields: name / phone only. Email + role come from the DB, never the client. ---
  const name = body.name !== undefined ? body.name.trim() : current.name;
  const phone = body.phone !== undefined ? body.phone.trim() : current.phone;

  if (name.length < 2) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
  }

  const user = (await updateUser(userId, name, phone)) ?? current;

  // --- customer travel profile (only customers have one) ---
  let profile: CustomerProfile | null =
    user.role === "customer" ? await getCustomerProfile(userId) : null;

  if (body.profile !== undefined) {
    if (user.role !== "customer") {
      return NextResponse.json(
        { error: "Only customer accounts have a travel profile." },
        { status: 400 },
      );
    }

    // Merge over the existing row so a partial payload can't wipe unrelated fields.
    const p = body.profile;
    const base = (await getCustomerProfile(userId)) ?? EMPTY_PROFILE;

    const pincode = (p.pincode ?? base.pincode).trim();
    if (!isValidPincode(pincode)) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit PIN code." },
        { status: 400 },
      );
    }

    let latitude = base.latitude;
    let longitude = base.longitude;
    if (p.latitude !== undefined || p.longitude !== undefined) {
      if (p.latitude == null && p.longitude == null) {
        latitude = null;
        longitude = null;
      } else if (
        typeof p.latitude === "number" &&
        typeof p.longitude === "number" &&
        isValidLatLng(p.latitude, p.longitude)
      ) {
        latitude = p.latitude;
        longitude = p.longitude;
      } else {
        return NextResponse.json(
          { error: "Provide both latitude and longitude as valid numbers, or clear both." },
          { status: 400 },
        );
      }
    }

    let preferredTags = base.preferredTags;
    if (p.preferredTags !== undefined) {
      const rawTags = Array.isArray(p.preferredTags) ? p.preferredTags : [];
      preferredTags = Array.from(
        new Set(
          rawTags.filter(
            (t): t is string => typeof t === "string" && isValidTravelTag(t),
          ),
        ),
      );
    }

    profile = await upsertCustomerProfile(userId, {
      addressLine1: p.addressLine1 ?? base.addressLine1,
      addressLine2: p.addressLine2 ?? base.addressLine2,
      city: p.city ?? base.city,
      state: p.state ?? base.state,
      pincode,
      latitude,
      longitude,
      preferredTags,
    });
  }

  return NextResponse.json({ user, profile });
}
