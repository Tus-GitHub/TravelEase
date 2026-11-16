"use client";

import { useState } from "react";
import { useAppInstall } from "./AppInstallProvider";

export default function InstallGuide() {
  const { available, installed, install } = useAppInstall();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    try {
      const result = await install();
      setMessage(result === "accepted" ? "Installation requested. Follow your browser to finish adding the app." : "You can add the app later using your browser menu below.");
    } catch { setMessage("Use your browser menu below to add the app to your home screen."); }
    finally { setBusy(false); }
  }
  return <>
    {installed ? <p role="status" className="mt-6 rounded-2xl border border-line bg-surface-muted p-4">You’re using the home-screen app. You’re ready to go.</p> : available ? <button data-ui-action="" type="button" onClick={() => void add()} disabled={busy} className="mt-6 min-h-11 rounded-xl bg-primary-800 px-6 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Opening…" : "Add to home screen"}</button> : null}
    <p role="status" aria-live="polite" className="mt-3 text-sm text-muted">{message}</p>
    <div className="mt-8 grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold">iPhone &amp; iPad</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-muted">
          <li>Open this website in Safari.</li>
          <li>Open the Share menu. Depending on your Safari layout, it may be inside the More (…) menu.</li>
          <li>Choose <strong className="text-fg">Add to Home Screen</strong>. You may need to scroll down.</li>
          <li>If shown, leave <strong className="text-fg">Open as Web App</strong> on, then tap <strong className="text-fg">Add</strong>.</li>
        </ol>
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold">Android</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-muted">
          <li>Open this website in Chrome.</li>
          <li>Tap <strong className="text-fg">Add to home screen</strong> above when available, or open Chrome’s menu (⋮).</li>
          <li>Choose <strong className="text-fg">Install app</strong> or <strong className="text-fg">Add to Home screen</strong>.</li>
          <li>Confirm, then open Jagdamba from your home screen.</li>
        </ol>
      </section>
    </div>
    <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">Your trips and account work just like they do on the website. An internet connection is needed for live prices, bookings and account access. If you opened this link inside another app, open it in Safari or Chrome first.</p>
  </>;
}
