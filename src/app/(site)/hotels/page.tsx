import type { Metadata } from "next";
import Link from "next/link";
import HotelSearch from "@/components/hotels/HotelSearch";
import { hotelDateAfter, hotelToday, parseHotelSearch, type HotelDestination } from "@/lib/hotels";
import { listHotelDestinations } from "@/lib/server/hotel-destinations";
import { hotelProviderConfigured } from "@/lib/server/hotel-provider";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hotel stays — Jagdamba Travellers", description: "Explore hotel stays near your travel destinations and ask our team for help.", robots: { index: false, follow: false } };
export default async function HotelsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  let destinations: HotelDestination[] = []; let loadFailed = false;
  try { destinations = await listHotelDestinations(); } catch { loadFailed = true; }
  const today = hotelToday();
  const connected = hotelProviderConfigured();
  const selected = destinations.find(city => city.id === Number(searchParams.city)) ?? destinations.find(city => city.regionId === Number(searchParams.region)) ?? destinations[0];
  let initial = { cityId: selected?.id ?? 0, checkin: hotelDateAfter(today, 1), checkout: hotelDateAfter(today, 2), adults: 2, nationality: "IN" };
  try { initial = parseHotelSearch({ cityId: selected?.id ?? 0, checkin: searchParams.checkin, checkout: searchParams.checkout, adults: Number(searchParams.adults), nationality: searchParams.nationality }); } catch { /* use safe defaults */ }
  return <main className="bg-canvas pb-16 pt-28 sm:pt-32">
    <div className="section-container">
      <Link href="/packages" className="text-sm font-semibold text-muted underline underline-offset-4">Back to travel packages</Link>
      <header className="relative my-6 overflow-hidden rounded-3xl bg-primary-950 px-6 py-8 text-white sm:px-10 sm:py-10">
        <div aria-hidden className="absolute -right-12 -top-24 h-80 w-80 rounded-full border-[40px] border-white/5" />
        <div className="relative max-w-2xl"><p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-accent-300">Stay a little longer</p><h1 className="font-display text-3xl font-semibold sm:text-4xl">Find your next comfortable stay</h1><p className="mt-4 text-sm leading-7 text-white/70 sm:text-base">Pair your journey with a place to unwind. Explore stays near your destination, then ask our team to help with the details.</p></div>
      </header>
      <p className="mb-6 rounded-2xl border border-accent-400/30 bg-accent-50 p-4 text-sm leading-6 text-primary-950 dark:bg-accent-950/20 dark:text-accent-200">{connected ? <><strong>Test hotel results.</strong> These options use test inventory. </> : <><strong>Stay enquiries.</strong> Our team will confirm availability and prices. </>}Enquiries do not reserve a room or take payment.</p>
      <HotelSearch destinations={destinations} initial={initial} today={today} connected={connected} loadFailed={loadFailed} />
    </div>
  </main>;
}
