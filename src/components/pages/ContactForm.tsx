"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import FormField, { fieldBase } from "@/components/forms/FormField";
import { useSiteContact } from "@/context/SiteContactContext";
import { contactReasons, supportHours } from "@/data/pages";
import type { IconName } from "@/types";
import { ContactError, parseContactInput } from "@/lib/contact";

export default function ContactForm() {
  const contact = useSiteContact();
  const messageHintId = useId();
  const details: { icon: IconName; label: string; value: string; href?: string }[] = [
    { icon: "phone", label: "Phone", value: contact.phone, href: `tel:${contact.phone.replace(/\s/g, "")}` },
    { icon: "mail", label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    { icon: "location", label: "Office", value: contact.address },
  ];

  const [form, setForm] = useState({
    name: "",
    email: "",
    reason: contactReasons[0],
    message: "",
    website: "",
  });
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const confirmation = useRef<HTMLDivElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { if (reference) confirmation.current?.focus(); }, [reference]);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending.current) return;
    setError("");
    const signature = JSON.stringify(form);
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    let input;
    try { input = parseContactInput({ ...form, requestId: attempt.current.id }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Check your form details."); return; }
    sending.current = true; setBusy(true);
    const abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 45_000);
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw new ContactError(typeof data.error === "string" ? data.error : "Could not submit your message. Please try again later.");
      if (data.ok !== true || typeof data.reference !== "string" || !/^CONTACT-[A-F0-9]{12}$/.test(data.reference)) throw new Error("Unconfirmed response");
      if (mounted.current) setReference(data.reference);
    } catch (reason) {
      if (mounted.current) setError(reason instanceof ContactError ? reason.message : "We could not confirm delivery. Your message may have been sent. Please wait before trying again, or use My Support.");
    } finally {
      clearTimeout(timer); sending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
      <Card padded hover={false}>
        {reference ? (
          <div ref={confirmation} tabIndex={-1} role="status" className="flex flex-col items-center py-10 text-center outline-none">
            <span className="animate-pop-check flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-fg">
              Thanks, {form.name.split(" ")[0] || "there"}!
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Your message was submitted by email. Our team can reply to{" "}
              <span className="break-all font-medium text-fg">{form.email}</span>.
            </p>
            <p className="mt-4 rounded-xl bg-surface-muted px-4 py-3 text-xs font-semibold text-fg">Reference: {reference}</p>
            <div className="mt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({ name: "", email: "", reason: contactReasons[0], message: "", website: "" });
                  setReference(""); setError(""); attempt.current = null;
                }}
              >
                Send another message
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} aria-label="Contact form" aria-busy={busy} className="flex flex-col gap-4">
            <div className="mb-1"><h2 className="font-display text-lg font-semibold text-fg">How can we help?</h2><p className="mt-1 text-sm text-muted">Send a message to our team. You don&apos;t need an account.</p></div>
            <FormField label="Your name" icon="user">
              <input
                type="text"
                required
                maxLength={100}
                disabled={busy}
                autoComplete="name"
                placeholder="Jane Doe"
                value={form.name}
                onChange={set("name")}
                className={fieldBase}
              />
            </FormField>

            <FormField label="Email" icon="mail">
              <input
                type="email"
                required
                maxLength={254}
                disabled={busy}
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set("email")}
                className={fieldBase}
              />
            </FormField>

            <FormField label="What's this about?" icon="headset">
              <select aria-label="What's this about?" value={form.reason} disabled={busy} onChange={set("reason")} className={fieldBase}>
                {contactReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </FormField>

            <label className="block text-left">
              <span className="mb-1.5 block text-xs font-semibold text-muted">Message</span>
              <textarea
                aria-label="Message"
                aria-describedby={messageHintId}
                required
                minLength={10}
                maxLength={4000}
                disabled={busy}
                rows={5}
                placeholder="How can we help?"
                value={form.message}
                onChange={set("message")}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-faint transition-[border-color,box-shadow] duration-200 hover:border-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/60"
              />
              <span id={messageHintId} className="mt-1 block text-xs text-faint">{form.message.length.toLocaleString()} / 4,000 characters. Please don&apos;t include passwords or payment details.</span>
            </label>
            <div hidden aria-hidden="true"><label>Leave this field empty<input name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" /></label></div>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><p>{error}</p><Link href="/profile/support" className="mt-2 inline-block font-semibold underline">Open My Support</Link></div>}
            <Button type="submit" variant="accent" size="lg" fullWidth disabled={busy} loading={busy}>
              {busy ? "Sending message…" : "Send message"}
            </Button>
            <p className="text-xs leading-5 text-muted">We&apos;ll use your name, email and message to respond to your enquiry. For an existing conversation, visit <Link href="/profile/support" className="font-semibold text-fg underline">My Support</Link>.</p>
          </form>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        {details.map((detail) => (
          <Card key={detail.label} padded hover={false}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-800 dark:bg-primary-950 dark:text-primary-300">
                <Icon name={detail.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                  {detail.label}
                </p>
                {detail.href ? (
                  <a href={detail.href} className="mt-1 block text-sm text-fg hover:text-primary-700">
                    {detail.value}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-fg">{detail.value}</p>
                )}
              </div>
            </div>
          </Card>
        ))}

        <Card padded hover={false}>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Support hours
          </p>
          <dl className="mt-3 space-y-2">
            {supportHours.map((row) => (
              <div key={row.label} className="text-sm">
                <dt className="font-medium text-fg">{row.label}</dt>
                <dd className="text-muted">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
