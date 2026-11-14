"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import BrandedDialog from "@/components/common/BrandedDialog";
import { useAuth } from "@/context/AuthContext";
import { HOTEL_NATIONALITIES, HotelError, hotelDateAfter, hotelEnquiry, parseHotelSearch, type HotelDestination, type HotelResult, type HotelSearchInput, type HotelSearchResult } from "@/lib/hotels";

interface Props { destinations: HotelDestination[]; initial: HotelSearchInput; connected: boolean; today: string; loadFailed: boolean }
const field = "mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm font-normal text-fg outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20";
const amount = (value: number, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

function HotelPhoto({ hotel, large = false }: { hotel: HotelResult; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`relative flex items-center justify-center overflow-hidden bg-surface-muted ${large ? "h-52 rounded-2xl" : "h-48"}`}>
    <div className="text-center text-faint"><Icon name="map-pin" className="mx-auto mb-2 h-9 w-9" /><span className="text-xs">Hotel photo unavailable</span></div>
    {hotel.imageUrl && !failed && <Image src={hotel.imageUrl} alt={hotel.name} fill unoptimized sizes="(max-width: 768px) 100vw, 50vw" referrerPolicy="no-referrer" className="object-cover" onError={() => setFailed(true)} />}
    <span className="absolute left-4 top-4 rounded-full bg-primary-950/90 px-3 py-1 text-xs font-semibold text-white">Test inventory</span>
  </div>;
}

function SearchForm({ destinations, initial, connected, today, loadFailed, userId }: Props & { userId?: string }) {
  const router = useRouter();
  const [input, setInput] = useState(initial);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [result, setResult] = useState<HotelSearchResult | null>(null);
  const [searchedInput, setSearchedInput] = useState<HotelSearchInput | null>(null);
  const [preview, setPreview] = useState<{ hotel: HotelResult | null; destination: HotelDestination; input: HotelSearchInput } | null>(null);
  const [note, setNote] = useState(""); const [sending, setSending] = useState(false); const [sendError, setSendError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const sendController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); sendController.current?.abort(); }; }, []);
  function change<K extends keyof HotelSearchInput>(key: K, value: HotelSearchInput[K]) {
    controller.current?.abort(); setBusy(false); setResult(null); setSearchedInput(null); setError("");
    setInput(previous => ({ ...previous, [key]: value }));
  }
  async function search(event: React.FormEvent) {
    event.preventDefault(); if (busy || !userId) return;
    setError(""); setResult(null);
    let validated: HotelSearchInput;
    try { validated = parseHotelSearch(input); }
    catch (reason) { setError((reason as Error).message); return; }
    setBusy(true); const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch("/api/hotels/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validated), signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Hotel search is unavailable. Please try again.");
      if (!data.result || data.result.sandbox !== true || data.result.destination?.id !== validated.cityId || !Array.isArray(data.result.hotels)) throw new Error("Could not read these hotel results. Please search again.");
      if (!abort.signal.aborted) { setResult(data.result); setSearchedInput(validated); }
    } catch (reason) { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not search hotels."); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  }
  function ask(hotel: HotelResult | null = null) {
    setError(""); setSendError(""); setNote("");
    try {
      const details = parseHotelSearch(hotel && searchedInput ? searchedInput : input);
      const destination = destinations.find(city => city.id === details.cityId);
      if (!destination) throw new Error("Choose a city first.");
      setPreview({ hotel, destination, input: details });
    } catch (reason) { setError((reason as Error).message); }
  }
  async function send() {
    if (!preview || sending || !userId) return;
    setSending(true); setSendError("");
    const abort = new AbortController(); sendController.current = abort;
    const timer = setTimeout(() => abort.abort(), 25_000);
    try {
      const response = await fetch("/api/support-tickets", { method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(hotelEnquiry(preview.input, preview.destination, preview.hotel, note)) });
      const data = await response.json();
      if (!response.ok) throw new HotelError(data.error || "Could not send your enquiry. Please try again.");
      if (typeof data.ticket?.id !== "string" || !/^[a-f0-9-]{36}$/i.test(data.ticket.id)) throw new HotelError("Could not read the confirmation. Check My Support before sending again.");
      if (mounted.current) router.push(`/profile/support/${data.ticket.id}`);
    } catch (reason) { if (mounted.current) { setSendError(reason instanceof HotelError ? reason.message : "Could not confirm delivery. Check My Support before sending again."); setSending(false); } }
    finally { clearTimeout(timer); }
  }
  const loginParams = new URLSearchParams({ city: String(input.cityId), checkin: input.checkin, checkout: input.checkout, adults: String(input.adults), nationality: input.nationality });
  const loginUrl = `/login?redirect=${encodeURIComponent(`/hotels?${loginParams}`)}`;
  return <>
    <form onSubmit={search} className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7" aria-label="Hotel search">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold text-fg">Find a place to pause</h2><span className="text-xs text-muted">1 room · 1–4 adults</span></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold text-fg">Destination<select aria-label="Destination" value={input.cityId} onChange={event => change("cityId", Number(event.target.value))} className={field} disabled={!destinations.length}>
          {!destinations.length && <option value={0}>No destinations available</option>}{destinations.map(city => <option key={city.id} value={city.id}>{city.name}, {city.regionName}</option>)}
        </select></label>
        <label className="text-sm font-semibold text-fg">Check-in<input type="date" required min={today} max={hotelDateAfter(today, 365)} value={input.checkin} onChange={event => change("checkin", event.target.value)} className={field} /></label>
        <label className="text-sm font-semibold text-fg">Check-out<input type="date" required min={input.checkin || today} value={input.checkout} onChange={event => change("checkout", event.target.value)} className={field} /></label>
        <label className="text-sm font-semibold text-fg">Adults<select aria-label="Adults" value={input.adults} onChange={event => change("adults", Number(event.target.value))} className={field}>{[1,2,3,4].map(count => <option key={count} value={count}>{count} {count === 1 ? "adult" : "adults"}</option>)}</select></label>
        <label className="text-sm font-semibold text-fg">Guest nationality<select aria-label="Guest nationality" value={input.nationality} onChange={event => change("nationality", event.target.value)} className={field}>{Object.entries(HOTEL_NATIONALITIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
        <div className="flex items-end"><Button type="submit" variant="accent" fullWidth iconLeft="search" loading={busy} disabled={busy || !userId || !destinations.length || !connected}>Search hotels</Button></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs leading-5 text-muted">
        <p>Need children, more rooms or another nationality? <Link href="/profile/support" className="font-semibold text-fg underline">Ask our team</Link>.</p>
        {userId && <Button type="button" variant="outline" size="sm" disabled={!destinations.length} onClick={() => ask()}>Request hotel help</Button>}
      </div>
      {!userId && <p className="mt-4 rounded-xl bg-surface-muted p-4 text-sm text-muted"><Link href={loginUrl} className="font-semibold text-fg underline">Sign in</Link> to search or send a stay enquiry. Your search details will be kept.</p>}
      {loadFailed && <p role="alert" className="mt-4 text-sm text-red-600">Could not load destinations. Please refresh the page.</p>}
      {!connected && <p className="mt-4 rounded-xl bg-surface-muted p-4 text-sm text-muted">Hotel search is not connected yet. You can still request help with your stay.</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    </form>
    <div className="mt-8" aria-live="polite" aria-busy={busy}>
      {busy && <p className="rounded-2xl border border-line bg-surface p-8 text-center text-muted">Looking for stays near your destination…</p>}
      {result && searchedInput && <>
        <div className="mb-5"><h2 className="font-display text-xl font-semibold text-fg">{result.hotels.length ? `Stay ideas near ${result.destination.name}` : "No test stays found for these dates"}</h2><p className="mt-2 text-sm text-muted">{searchedInput.checkin} to {searchedInput.checkout} · 1 room · {searchedInput.adults} adults. Sample totals are for the full stay; property charges may be extra.</p></div>
        {!result.hotels.length && <p className="rounded-2xl border border-line bg-surface p-6 text-muted">Try different dates or request hotel help above. No rooms have been reserved.</p>}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{result.hotels.map(hotel => <article key={hotel.id} className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
          <HotelPhoto hotel={hotel} /><div className="flex flex-1 flex-col p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted">{hotel.stars ? `${hotel.stars}-star hotel` : "Hotel"}</p><h3 className="mt-2 font-display text-lg font-semibold text-fg">{hotel.name}</h3><p className="mt-2 text-sm leading-6 text-muted">{hotel.address || result.destination.name}</p><p className="mt-4 text-sm text-fg">{hotel.room}</p><p className="mt-1 text-xs text-muted">{hotel.board}</p><div className="mt-auto pt-5"><p className="font-display text-xl font-semibold text-fg">{hotel.total === null ? "Quote on request" : amount(hotel.total)}</p><p className="mb-4 mt-1 text-xs text-muted">Sample stay total · additional charges may apply</p><Button variant="outline" type="button" fullWidth onClick={() => ask(hotel)}>View stay & enquire</Button></div></div>
        </article>)}</div>
      </>}
      {!busy && !result && <div className="py-10 text-center"><Icon name="map-pin" className="mx-auto h-8 w-8 text-accent-500" /><p className="mt-3 font-semibold text-fg">A comfortable stay, alongside your journey</p><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">Explore hotels near our travel destinations. Hotel enquiries are separate from your vehicle booking and price.</p></div>}
    </div>
    {preview && <BrandedDialog title={preview.hotel?.name ?? `Your stay in ${preview.destination.name}`} description="Development test enquiry. Our team must confirm a real quote; this does not reserve or pay for a room." busy={sending} onClose={() => setPreview(null)}>
      <div className="space-y-5 p-5 sm:p-8">
        {preview.hotel && <HotelPhoto hotel={preview.hotel} large />}
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-muted p-4 text-sm"><div><p className="text-xs text-muted">Check-in</p><p className="mt-1 font-semibold text-fg">{preview.input.checkin}</p></div><div><p className="text-xs text-muted">Check-out</p><p className="mt-1 font-semibold text-fg">{preview.input.checkout}</p></div><p className="col-span-2 text-muted">1 room · {preview.input.adults} adults · {HOTEL_NATIONALITIES[preview.input.nationality as keyof typeof HOTEL_NATIONALITIES]}</p></div>
        {preview.hotel && <div className="space-y-3 text-sm text-muted"><p className="font-semibold text-fg">{preview.hotel.room} · {preview.hotel.board}</p><p className="font-display text-xl font-semibold text-fg">{preview.hotel.total === null ? "Quote on request" : `${amount(preview.hotel.total)} sample stay total`}</p><p>{preview.hotel.cancellation}</p>{preview.hotel.propertyFees.length > 0 && <div><p className="mb-2 font-semibold text-fg">Additional property charges</p><ul className="space-y-1">{preview.hotel.propertyFees.map((fee, index) => <li key={index}>{fee.label}: {fee.amount !== null && fee.currency ? amount(fee.amount, fee.currency) : "Confirm amount with the hotel"}</li>)}</ul></div>}<p className="text-xs">All prices and policies shown are test data. Taxes, extra fees and final availability require confirmation.</p></div>}
        <label className="block text-sm font-semibold text-fg">Anything we should know?<textarea rows={3} maxLength={1000} value={note} disabled={sending} onChange={event => setNote(event.target.value)} className={field} placeholder="Preferred room, arrival time or other requests" /></label>
        <p className="text-xs leading-5 text-muted">Sending creates a conversation in My Support. You can read and reply there. No supplier booking or payment is submitted.</p>
        {sendError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{sendError}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5"><Button type="button" variant="outline" disabled={sending} onClick={() => setPreview(null)}>Keep browsing</Button><Button type="button" variant="accent" loading={sending} disabled={sending || !userId} onClick={() => void send()}>Send hotel enquiry</Button></div>
      </div>
    </BrandedDialog>}
  </>;
}
export default function HotelSearch(props: Props) {
  const { user } = useAuth();
  return <SearchForm key={user?.id ?? "guest"} {...props} userId={user?.id} />;
}
