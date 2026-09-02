"use client";

import { useEffect, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";

interface SiteSettings {
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  defaults: { contactPhone: string; contactEmail: string; contactAddress: string };
}

const fieldCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export default function AdminSettingsPage() {
  const { isLoading, allowed } = useAdminSectionGuard("settings");

  const [data, setData] = useState<SiteSettings | null>(null);
  const [form, setForm] = useState({ contactPhone: "", contactEmail: "", contactAddress: "" });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!allowed) return;
    fetch("/api/admin/site-settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { item: SiteSettings }) => {
        setData(d.item);
        setForm({
          contactPhone: d.item.contactPhone,
          contactEmail: d.item.contactEmail,
          contactAddress: d.item.contactAddress,
        });
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [allowed]);

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: d.error ?? "Couldn't save." });
      } else {
        setData(d.item);
        setMsg({ kind: "ok", text: "Saved. Live within a minute." });
      }
    } catch {
      setMsg({ kind: "err", text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  };

  const fields: {
    key: keyof typeof form;
    label: string;
    hint: string;
    type?: string;
  }[] = [
    {
      key: "contactPhone",
      label: "Contact / pay-by-phone number",
      hint: "Shown on the booking confirmation page, the booking detail page, the confirmation + status emails, and the site footer.",
    },
    { key: "contactEmail", label: "Support email", hint: "Footer and contact page.", type: "email" },
    { key: "contactAddress", label: "Office address", hint: "Footer and contact page." },
  ];

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Site settings</h1>
        <p className="text-sm text-muted">
          Contact details customers see. Leave a field blank to use the built-in default.
        </p>
      </header>

      {state === "error" ? (
        <Card padded hover={false}>
          <p className="text-sm text-muted">Couldn&apos;t load the settings.</p>
        </Card>
      ) : state === "loading" ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <Card padded hover={false} className="max-w-xl">
          <form onSubmit={save} className="flex flex-col gap-5">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-sm font-semibold text-fg">{f.label}</span>
                <input
                  className={fieldCls}
                  type={f.type ?? "text"}
                  value={form[f.key]}
                  placeholder={data?.defaults[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
                <span className="mt-1 block text-xs text-faint">
                  {f.hint}
                  {data?.defaults[f.key] ? ` Default: ${data.defaults[f.key]}` : ""}
                </span>
              </label>
            ))}

            {msg && (
              <p
                className={`text-sm ${
                  msg.kind === "ok"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {msg.text}
              </p>
            )}

            <div>
              <Button type="submit" variant="accent" size="sm" loading={busy}>
                Save settings
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
