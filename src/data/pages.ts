import type { IconName } from "@/types";

/** Content for the standalone marketing / support / legal pages. */

export const aboutIntro = [
  "Jagdamba Travellers started with a simple frustration: booking a reliable car with a good driver for an intercity trip in India was harder than it should be. Prices were opaque, vehicles were hit-or-miss, and you never knew who would show up.",
  "We set out to fix that. Every Jagdamba Travellers trip is chauffeur-driven by a verified driver, in a maintained vehicle, at a fare you can see in full before you book — whether it's a 20-minute airport run or a five-day Rajasthan tour.",
];

export const aboutStats = [
  { value: "500+", label: "Vehicles in the fleet" },
  { value: "50K+", label: "Journeys completed" },
  { value: "120+", label: "Cities covered" },
  { value: "4.9/5", label: "Average trip rating" },
];

export const aboutStory = [
  {
    year: "2023",
    title: "The first ten cars",
    body: "Jagdamba Travellers launched in Mumbai with a small owned fleet and a promise: no self-drive, no surprises.",
  },
  {
    year: "2024",
    title: "Five ways to travel",
    body: "Point-to-point, hourly, outstation, airport transfer and multi-day packages — all through one transparent pricing engine.",
  },
  {
    year: "2025",
    title: "Build-your-own trips",
    body: "The Package Builder arrived, letting travellers design their own multi-stop routes on a map.",
  },
  {
    year: "2026",
    title: "120+ cities",
    body: "Now operating across the country, still chauffeur-only, still showing the full fare up front.",
  },
];

export const bookingSteps: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "search",
    title: "Tell us your trip",
    body: "Enter your pickup, drop, travel date and the kind of vehicle you need.",
  },
  {
    icon: "car",
    title: "Pick a vehicle & see the price",
    body: "Compare chauffeur-driven options with transparent, all-inclusive fares.",
  },
  {
    icon: "check",
    title: "Confirm and ride",
    body: "Book now and pay offline. Your driver's details reach you before pickup.",
  },
];

export const popularRoutes = [
  { from: "Delhi", to: "Jaipur", note: "~5 hrs · Outstation" },
  { from: "Mumbai", to: "Pune", note: "~3 hrs · Point-to-point" },
  { from: "Bengaluru", to: "Mysuru", note: "~3.5 hrs · Outstation" },
  { from: "Delhi Airport T3", to: "Gurugram", note: "Airport transfer · Flat fare" },
  { from: "Chandigarh", to: "Manali", note: "~8 hrs · Hill route" },
  { from: "Ahmedabad", to: "Udaipur", note: "~4.5 hrs · Outstation" },
];

export const contactReasons = [
  "General enquiry",
  "Help with a booking",
  "Billing & refunds",
  "Partnerships",
  "Feedback",
];

export const supportHours = [
  { label: "Phone support", value: "Mon–Sun, 6:00 – 23:00 IST" },
  { label: "Email & chat", value: "24 / 7, replies within a few hours" },
  { label: "On-trip assistance", value: "24 / 7 while your trip is active" },
];

export const faqs: { category: string; icon: IconName; items: { q: string; a: string }[] }[] = [
  {
    category: "Booking",
    icon: "calendar",
    items: [
      {
        q: "How do I book a vehicle?",
        a: "Search from the homepage or the Booking page, pick a vehicle, review the full fare, and confirm. You'll receive your driver's details before pickup.",
      },
      {
        q: "Can I book on behalf of someone else?",
        a: "Yes. Add the traveller's name and phone number during checkout so the driver can coordinate directly with them.",
      },
      {
        q: "How far in advance should I book?",
        a: "Airport transfers and city rides can usually be same-day. Outstation and multi-day trips are best booked 24–48 hours ahead so we can assign the right vehicle and driver.",
      },
    ],
  },
  {
    category: "Payments",
    icon: "tag",
    items: [
      {
        q: "How do I pay?",
        a: "Right now Jagdamba Travellers is book now, pay offline — settle with the driver or against an invoice. Online payments are coming soon.",
      },
      {
        q: "Are tolls and driver allowance included?",
        a: "Each fare shows exactly what's included. Outstation and multi-day trips list driver allowance and any night charges as separate line items.",
      },
      {
        q: "Is GST charged?",
        a: "Yes. GST is applied at the applicable rate and shown on your fare breakdown before you confirm.",
      },
    ],
  },
  {
    category: "Cancellations",
    icon: "shield-check",
    items: [
      {
        q: "What is the cancellation policy?",
        a: "Free cancellation more than 72 hours before pickup, a 50% charge between 24 and 72 hours, and no refund within 24 hours. Full details are on the Cancellation Policy page.",
      },
      {
        q: "How do I cancel a trip?",
        a: "Open the trip under Profile → Bookings and cancel from there, or contact support and we'll do it for you.",
      },
      {
        q: "What if Jagdamba Travellers cancels my trip?",
        a: "If we cancel for any reason, you receive a 100% refund.",
      },
    ],
  },
  {
    category: "Vehicles & drivers",
    icon: "car",
    items: [
      {
        q: "Are your vehicles self-drive?",
        a: "No. Every Jagdamba Travellers trip is chauffeur-driven — verified drivers only, never self-drive.",
      },
      {
        q: "Are the drivers verified?",
        a: "Yes. Every driver is background-checked, licensed, and rated by travellers who rode with them before.",
      },
      {
        q: "What if my plans change during the trip?",
        a: "Call support. Extra hours or kilometres are billed at the vehicle's listed rates, with no penalty for reasonable changes.",
      },
    ],
  },
];

export const legalUpdated = "1 August 2026";

export const cancellationIntro =
  "This policy explains what you can expect if a trip is cancelled — by you or by us. It applies to all booking types unless your confirmation says otherwise.";

export const cancellationTiers: {
  window: string;
  refund: string;
  tone: "success" | "accent" | "neutral";
}[] = [
  { window: "More than 72 hours before pickup", refund: "Full refund", tone: "success" },
  { window: "24 – 72 hours before pickup", refund: "50% charge", tone: "accent" },
  { window: "Less than 24 hours before pickup", refund: "No refund", tone: "neutral" },
  { window: "Cancelled by Jagdamba Travellers", refund: "100% refund", tone: "success" },
];

export const cancellationSections = [
  {
    heading: "How to cancel",
    body: [
      "Cancel from the trip page under Profile → Bookings, or contact support and we'll process it for you.",
      "The refund amount is calculated from the time we receive your cancellation request, not the time you started it.",
    ],
  },
  {
    heading: "Refund timing",
    body: [
      "Approved refunds for offline payments are settled by bank transfer or adjusted against a future trip, usually within 5–7 working days.",
      "Once online payments launch, refunds will return to your original payment method.",
    ],
  },
  {
    heading: "Trips we cancel",
    body: [
      "If Jagdamba Travellers cancels a confirmed trip — for a vehicle breakdown, driver unavailability or any operational reason — you receive a full refund, regardless of timing.",
      "We'll always try to arrange an equivalent replacement vehicle first.",
    ],
  },
  {
    heading: "No-shows and partial trips",
    body: [
      "If the vehicle arrives and the traveller is unreachable for 60 minutes past the pickup time, the trip is treated as a no-show and no refund applies.",
      "Trips cut short after they begin are charged for the distance and time actually used, plus applicable fixed charges.",
    ],
  },
];

export const termsIntro =
  "These terms govern your use of the Jagdamba Travellers website and booking services. By creating an account or placing a booking, you agree to them.";

export const termsSections = [
  {
    heading: "Bookings and confirmations",
    body: [
      "A booking is confirmed only when you receive a confirmation with a booking reference. Until then, vehicle availability and pricing may change.",
      "You are responsible for providing accurate pickup, drop and traveller details.",
    ],
  },
  {
    heading: "Fares, taxes and payment",
    body: [
      "The fare shown before you confirm is the fare that applies, including GST and any listed driver allowance or night charges.",
      "Additional hours, kilometres, tolls, parking or state permits used beyond the booked scope are billed at the rates shown for that vehicle.",
    ],
  },
  {
    heading: "Cancellations and refunds",
    body: [
      "Cancellations are governed by the Cancellation & Refund Policy, which forms part of these terms.",
    ],
  },
  {
    heading: "Conduct during trips",
    body: [
      "All trips are chauffeur-driven. Smoking, illegal substances, and unsafe or abusive behaviour towards drivers are not permitted and may result in the trip being ended without refund.",
      "The passenger count must not exceed the vehicle's seating capacity.",
    ],
  },
  {
    heading: "Liability",
    body: [
      "Jagdamba Travellers arranges transport through its own fleet and vetted drivers and is not liable for delays caused by traffic, weather, road closures or events outside our reasonable control.",
      "Our total liability for any claim relating to a trip is limited to the amount paid for that trip.",
    ],
  },
  {
    heading: "Changes to these terms",
    body: [
      "We may update these terms from time to time. Material changes will be notified on this page with a revised 'last updated' date. Continued use after a change means you accept it.",
    ],
  },
];

export const privacyIntro =
  "This policy explains what information Jagdamba Travellers collects, why, and what choices you have. It covers the website, the booking flow and your account.";

export const privacySections = [
  {
    heading: "Information we collect",
    body: [
      "Account details you provide: name, email, phone number and password (stored only as a hash).",
      "Trip details: pickup and drop locations, dates, traveller names, and any notes you add to a booking.",
      "Optionally, a saved address and travel-interest tags, and — if you choose to set it — a map location for your profile.",
    ],
  },
  {
    heading: "How we use your information",
    body: [
      "To create and manage your bookings, assign a vehicle and driver, calculate fares, and keep you updated about your trip.",
      "To suggest destinations and packages that match your saved travel interests.",
      "To provide support and to improve the service.",
    ],
  },
  {
    heading: "Location data",
    body: [
      "If you pin a location on your profile or use the 'use my current location' option, we store the coordinates to power nearby-destination suggestions and to set a default pickup point.",
      "You can clear this at any time from your profile. We do not track your live location.",
    ],
  },
  {
    heading: "Sharing with drivers and partners",
    body: [
      "The assigned driver receives the traveller name, phone number and trip details needed to complete the journey.",
      "We use third-party services for map tiles and address lookup; requests are proxied through our servers and are not linked to your account by those providers.",
    ],
  },
  {
    heading: "Data retention and security",
    body: [
      "Booking records are retained for as long as needed for accounting, legal and support purposes.",
      "Passwords are hashed, sessions are stored server-side, and connections use HTTPS in production.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "You can view and edit your account and profile details at any time, and request deletion of your account by contacting support.",
    ],
  },
];
