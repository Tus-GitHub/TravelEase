"use client";

import { useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import FormField, { fieldBase } from "@/components/forms/FormField";
import { site } from "@/data/site";
import { contactReasons, supportHours } from "@/data/pages";
import type { IconName } from "@/types";

const details: { icon: IconName; label: string; value: string; href?: string }[] = [
  { icon: "phone", label: "Phone", value: site.contact.phone, href: `tel:${site.contact.phone.replace(/\s/g, "")}` },
  { icon: "mail", label: "Email", value: site.contact.email, href: `mailto:${site.contact.email}` },
  { icon: "location", label: "Office", value: site.contact.address },
];

export default function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    reason: contactReasons[0],
    message: "",
  });
  const [sent, setSent] = useState(false);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
      <Card padded hover={false}>
        {sent ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-slate-900">
              Thanks, {form.name.split(" ")[0] || "there"}!
            </h2>
            <p className="mt-1 max-w-sm text-sm text-slate-600">
              Your message is in. Our support team will get back to you at{" "}
              <span className="font-medium text-slate-800">{form.email}</span> within a few hours.
            </p>
            <div className="mt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({ name: "", email: "", reason: contactReasons[0], message: "" });
                  setSent(false);
                }}
              >
                Send another message
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Your name" icon="user">
              <input
                type="text"
                required
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
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set("email")}
                className={fieldBase}
              />
            </FormField>

            <FormField label="What's this about?" icon="headset">
              <select value={form.reason} onChange={set("reason")} className={fieldBase}>
                {contactReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </FormField>

            <label className="block text-left">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Message</span>
              <textarea
                required
                rows={5}
                placeholder="How can we help?"
                value={form.message}
                onChange={set("message")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </label>

            <Button type="submit" variant="accent" size="lg" fullWidth>
              Send message
            </Button>
          </form>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        {details.map((detail) => (
          <Card key={detail.label} padded hover={false}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-800">
                <Icon name={detail.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {detail.label}
                </p>
                {detail.href ? (
                  <a href={detail.href} className="mt-1 block text-sm text-slate-800 hover:text-primary-700">
                    {detail.value}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-slate-800">{detail.value}</p>
                )}
              </div>
            </div>
          </Card>
        ))}

        <Card padded hover={false}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Support hours
          </p>
          <dl className="mt-3 space-y-2">
            {supportHours.map((row) => (
              <div key={row.label} className="text-sm">
                <dt className="font-medium text-slate-800">{row.label}</dt>
                <dd className="text-slate-500">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
