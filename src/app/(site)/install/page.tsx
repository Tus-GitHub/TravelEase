import type { Metadata } from "next";
import InstallGuide from "@/components/app/InstallGuide";

export const metadata: Metadata = { title: "Add to home screen · Jagdamba Travellers" };
export default function InstallPage() {
  return <main className="section-container pb-16 pt-28 md:pt-36">
    <div className="mx-auto max-w-3xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/app-192.png" alt="" width={72} height={72} className="mb-6 rounded-2xl" />
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Your next trip, one tap away.</h1>
      <p className="mt-4 text-lg text-muted">Add Jagdamba Travellers to your home screen and open it like an app.</p>
      <InstallGuide />
    </div>
  </main>;
}
