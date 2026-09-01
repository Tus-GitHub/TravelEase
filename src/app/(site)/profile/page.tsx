"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Section from "@/components/common/Section";
import Card from "@/components/common/Card";
import Avatar from "@/components/common/Avatar";
import Badge from "@/components/common/Badge";
import Icon from "@/components/common/Icon";
import Button from "@/components/common/Button";
import FormField, { fieldBase } from "@/components/forms/FormField";
import Skeleton from "@/components/common/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { isValidPhone, isValidPincode } from "@/lib/validation";
import { TRAVEL_TAGS } from "@/lib/travelTags";
import type { IconName } from "@/types";

// Leaflet touches `window`, so the map only loads in the browser.
const LocationPicker = dynamic(() => import("@/components/forms/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-surface-hover" />,
});

interface AccountData {
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
}

interface ProfileData {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  preferredTags: string[];
}

const EMPTY_PROFILE: ProfileData = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  latitude: null,
  longitude: null,
  preferredTags: [],
};

const roleTone: Record<string, "neutral" | "primary" | "accent"> = {
  customer: "neutral",
  agent: "primary",
  admin: "accent",
};

type PatchResult =
  | { ok: true; user: AccountData; profile: ProfileData | null }
  | { ok: false; error: string };

async function patchProfile(payload: Record<string, unknown>): Promise<PatchResult> {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong. Please try again." };
  return { ok: true, user: data.user, profile: data.profile ?? null };
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading, logout, deleteAccount, refreshUser } = useAuth();

  const [account, setAccount] = useState<AccountData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Kick guests back to login once we know for sure there's no session.
  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    fetch("/api/profile")
      .then((res) => {
        if (!res.ok) throw new Error(`profile ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data?.user) return;
        setAccount(data.user);
        setProfile(data.profile ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Network / server error loading the profile — recoverable, not a dead end.
  if (loaded && loadError && !account) {
    return (
      <Section bg="gray" eyebrow="Account" title="Profile Settings">
        <Card padded hover={false} className="mx-auto max-w-md text-center">
          <p className="text-sm text-muted">
            We couldn&apos;t load your profile. Check your connection and try again.
          </p>
          <div className="mt-4">
            <Button
              variant="accent"
              size="sm"
              onClick={() => {
                setLoaded(false);
                setReloadKey((k) => k + 1);
              }}
            >
              Retry
            </Button>
          </div>
        </Card>
      </Section>
    );
  }

  if (isLoading || !user || !loaded || !account) {
    return (
      <Section bg="gray" eyebrow="Account" title="Profile Settings">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div className="rounded-2xl border border-line-subtle bg-surface p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-56" />
              </div>
            </div>
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line-subtle bg-surface p-6">
              <Skeleton className="h-5 w-32" />
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  const isCustomer = account.role === "customer";
  const memberSince = new Date(account.createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Section
      bg="gray"
      eyebrow="Account"
      title="Profile Settings"
      subtitle="Manage your details and travel preferences."
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card padded hover={false}>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={account.name} className="h-16 w-16 text-lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-lg font-bold text-fg">{account.name}</p>
                <Badge tone={roleTone[account.role] ?? "neutral"} className="capitalize">
                  {account.role}
                </Badge>
              </div>
              <p className="text-sm text-muted">Member since {memberSince}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              iconLeft="logout"
              onClick={() => {
                logout();
                router.push("/");
              }}
            >
              Logout
            </Button>
          </div>
        </Card>

        <AccountCard
          account={account}
          onSaved={(next) => {
            setAccount(next);
            refreshUser();
          }}
        />

        {isCustomer && (
          <>
            <AddressCard profile={profile ?? EMPTY_PROFILE} onSaved={setProfile} />
            <PreferencesCard profile={profile ?? EMPTY_PROFILE} onSaved={setProfile} />
          </>
        )}

        <DangerZoneCard
          isCustomer={isCustomer}
          onDeleted={async () => {
            await deleteAccount();
            router.replace("/");
          }}
        />
      </div>
    </Section>
  );
}

function DangerZoneCard({
  isCustomer,
  onDeleted,
}: {
  isCustomer: boolean;
  onDeleted: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setConfirming(false);
    setText("");
    setError(null);
  };

  const del = async () => {
    if (text.trim() !== "DELETE") {
      setError('Type "DELETE" exactly to confirm.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onDeleted();
    } catch {
      setBusy(false);
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <Card padded hover={false} className="border-red-300 dark:border-red-500/40">
      <h2 className="text-base font-bold text-red-700 dark:text-red-300">Delete account</h2>
      <p className="mt-1 text-sm text-muted">
        Permanently deletes your account and{" "}
        {isCustomer ? "erases your saved address, map location and travel preferences" : "your profile data"}.
        This can&apos;t be undone. You can sign up again later with the same email as a fresh account.
      </p>

      {confirming ? (
        <div className="mt-4 flex flex-col gap-3">
          <FormField label='Type "DELETE" to confirm' icon="trash">
            <input
              className={fieldBase}
              value={text}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") del();
              }}
            />
          </FormField>
          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={del}
              disabled={busy || text.trim() !== "DELETE"}
            >
              {busy ? "Deleting…" : "Delete my account"}
            </Button>
            <Button variant="outline" size="sm" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button variant="danger" size="sm" iconLeft="trash" onClick={() => setConfirming(true)}>
            Delete my account
          </Button>
        </div>
      )}
    </Card>
  );
}

function CardHeader({
  title,
  subtitle,
  onEdit,
}: {
  title: string;
  subtitle?: string;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-bold text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {onEdit && (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      )}
    </div>
  );
}

function ReadField({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
        <Icon name={icon} className="h-4 w-4" />
        {label}
      </dt>
      <dd className="mt-1 text-sm text-fg">{value || "—"}</dd>
    </div>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{message}</p>
  );
}

function AccountCard({
  account,
  onSaved,
}: {
  account: AccountData;
  onSaved: (next: AccountData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setName(account.name);
    setPhone(account.phone);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Please enter a valid phone number.");
      return;
    }
    setSaving(true);
    const result = await patchProfile({ name: name.trim(), phone: phone.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.user);
    setEditing(false);
  };

  return (
    <Card padded hover={false}>
      <CardHeader title="Account details" onEdit={editing ? undefined : start} />
      <ErrorNote message={error} />

      {editing ? (
        <div className="mt-4 flex flex-col gap-4">
          <FormField label="Full name" icon="user">
            <input
              className={fieldBase}
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Phone" icon="phone">
            <input
              className={fieldBase}
              value={phone}
              autoComplete="tel"
              inputMode="tel"
              onChange={(e) => setPhone(e.target.value)}
            />
          </FormField>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted">Email</span>
            <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-sm text-muted">
              {account.email}
            </p>
            <p className="mt-1 text-xs text-faint">Email can’t be changed.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="accent" size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <ReadField icon="user" label="Full name" value={account.name} />
          <ReadField icon="mail" label="Email" value={account.email} />
          <ReadField icon="phone" label="Phone" value={account.phone} />
        </dl>
      )}
    </Card>
  );
}

function AddressCard({
  profile,
  onSaved,
}: {
  profile: ProfileData;
  onSaved: (next: ProfileData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(profile);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setForm(profile);
    setError(null);
    setEditing(true);
  };

  const set = (key: keyof ProfileData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setError(null);
    if (!isValidPincode(form.pincode)) {
      setError("Please enter a valid 6-digit PIN code.");
      return;
    }
    setSaving(true);
    // The API upserts the whole profile row, so carry the tags through untouched.
    const result = await patchProfile({
      profile: { ...form, preferredTags: profile.preferredTags },
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.profile) onSaved(result.profile);
    setEditing(false);
  };

  const hasAddress =
    profile.addressLine1 || profile.city || profile.state || profile.pincode;

  return (
    <Card padded hover={false}>
      <CardHeader
        title="Address"
        subtitle="Used for pickups and booking details."
        onEdit={editing ? undefined : start}
      />
      <ErrorNote message={error} />

      {editing ? (
        <div className="mt-4 flex flex-col gap-4">
          <FormField label="Address line 1" icon="map-pin">
            <input
              className={fieldBase}
              value={form.addressLine1}
              onChange={(e) => set("addressLine1", e.target.value)}
            />
          </FormField>
          <FormField label="Address line 2" icon="map-pin">
            <input
              className={fieldBase}
              value={form.addressLine2}
              onChange={(e) => set("addressLine2", e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="City" icon="location">
              <input
                className={fieldBase}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </FormField>
            <FormField label="State" icon="location">
              <input
                className={fieldBase}
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
              />
            </FormField>
            <FormField label="PIN code" icon="location">
              <input
                className={fieldBase}
                value={form.pincode}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => set("pincode", e.target.value)}
              />
            </FormField>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold text-muted">
              Pin your location <span className="font-normal text-faint">(optional)</span>
            </span>
            <p className="mb-2 text-xs text-faint">
              Search, use your current location, or drag the pin. Powers nearby-destination
              suggestions.
            </p>
            <LocationPicker
              value={
                form.latitude != null && form.longitude != null
                  ? { lat: form.latitude, lng: form.longitude }
                  : null
              }
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  latitude: v ? v.lat : null,
                  longitude: v ? v.lng : null,
                }))
              }
              onResolve={(r) =>
                setForm((f) => ({
                  ...f,
                  city: f.city.trim() ? f.city : r.city,
                  state: f.state.trim() ? f.state : r.state,
                  pincode: f.pincode.trim() ? f.pincode : r.pincode,
                }))
              }
            />
          </div>

          <div className="flex gap-2">
            <Button variant="accent" size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save address"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {hasAddress ? (
            <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ReadField
                icon="map-pin"
                label="Address"
                value={[profile.addressLine1, profile.addressLine2].filter(Boolean).join(", ")}
              />
              <ReadField icon="location" label="City" value={profile.city} />
              <ReadField icon="location" label="State" value={profile.state} />
              <ReadField icon="location" label="PIN code" value={profile.pincode} />
            </dl>
          ) : (
            profile.latitude == null && (
              <p className="mt-4 text-sm text-muted">No address saved yet.</p>
            )
          )}
          {profile.latitude != null && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
              <Icon name="map-pin" className="h-3.5 w-3.5" />
              Map location pinned
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function PreferencesCard({
  profile,
  onSaved,
}: {
  profile: ProfileData;
  onSaved: (next: ProfileData) => void;
}) {
  const [tags, setTags] = useState<string[]>(profile.preferredTags);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    setTags(profile.preferredTags);
  }, [profile.preferredTags]);

  const dirty = useMemo(() => {
    const a = [...tags].sort().join("|");
    const b = [...profile.preferredTags].sort().join("|");
    return a !== b;
  }, [tags, profile.preferredTags]);

  const toggle = (tag: string) =>
    setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

  const save = async () => {
    setError(null);
    setSaving(true);
    const result = await patchProfile({ profile: { ...profile, preferredTags: tags } });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.profile) onSaved(result.profile);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 2500);
  };

  return (
    <Card padded hover={false}>
      <CardHeader
        title="Travel preferences"
        subtitle="We’ll use these to suggest destinations you’ll love."
      />
      <ErrorNote message={error} />

      <div className="mt-4 flex flex-wrap gap-2">
        {TRAVEL_TAGS.map((tag) => {
          const active = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-[transform,color,background-color,border-color] duration-150 active:scale-95 motion-reduce:active:scale-100 ${
                active
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-line bg-surface text-muted hover:border-faint"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button variant="accent" size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
        {savedNote && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Saved</span>}
      </div>
    </Card>
  );
}
