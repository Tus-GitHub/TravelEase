"use client";

import { useEffect, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";

export default function MobileLoginCard() {
  const [status, setStatus] = useState<{ enabled: boolean; linked: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const notices: Record<string, string> = {
      "mobile-linked": "Mobile OTP login is now enabled for this account.",
      "mobile-unavailable": "Mobile OTP is currently unavailable. Email and Google sign-in still work.",
      "mobile-cancelled": "Mobile verification was cancelled.",
      "mobile-failed": "Couldn't link this mobile login. It may belong to another account. Your previous login options still work.",
    };
    setNotice(notices[new URLSearchParams(window.location.search).get("notice") ?? ""] ?? "");
    setFailed(false);
    fetch("/api/auth/mobile/status", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Unavailable");
      const next = await response.json();
      if (!cancelled) setStatus(next);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [reload]);

  async function unlink() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/mobile/status", { method: "DELETE" });
      if (!response.ok) throw new Error("Failed");
      setStatus((previous) => previous ? { ...previous, linked: false } : null);
      setNotice("Mobile login removed. Other devices have been signed out. Email and Google sign-in are still available.");
    } catch { setNotice("Couldn't remove mobile login. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <Card padded hover={false}>
      <h2 className="text-base font-bold text-fg">Mobile OTP login</h2>
      <p className="mt-1 text-sm text-muted">{status?.linked ? "A verified mobile login is linked to your account." : "Link a mobile number once to sign in with SMS codes. Email and password or Google remain available."}</p>
      <p className="mt-2 text-xs text-muted">Your contact phone number is separate from your verified login. Linking or replacing mobile login signs out your other devices.</p>
      {notice && <p role="status" className="mt-3 text-sm text-fg">{notice}</p>}
      {failed ? <Button className="mt-4" variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>Retry mobile login settings</Button> : !status ? <p className="mt-3 text-sm text-muted" role="status">Loading login options…</p> : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {status.enabled ? <form action="/api/auth/mobile" method="post">
            <Button type="submit" variant="outline" size="sm">{status.linked ? "Replace mobile login" : "Enable mobile OTP"}</Button>
          </form> : <p className="text-sm text-muted">Mobile OTP setup is not available yet.</p>}
          {status.linked && <Button variant="outline" size="sm" onClick={unlink} disabled={busy}>{busy ? "Removing…" : "Remove mobile login"}</Button>}
        </div>
      )}
    </Card>
  );
}
