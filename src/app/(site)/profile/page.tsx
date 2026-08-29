"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Section from "@/components/common/Section";
import Card from "@/components/common/Card";
import Avatar from "@/components/common/Avatar";
import Icon from "@/components/common/Icon";
import Button from "@/components/common/Button";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  // Kick guests back to login once we know for sure there's no session.
  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <Section bg="gray" className="!py-32">
        <p className="text-center text-sm text-slate-500">Loading…</p>
      </Section>
    );
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Section
      bg="gray"
      eyebrow="Account"
      title="Profile Settings"
      subtitle="Your account details at a glance."
    >
      <div className="mx-auto w-full max-w-2xl">
        <Card padded>
          <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
            <Avatar name={user.name} className="h-16 w-16 text-lg" />
            <div>
              <p className="text-lg font-bold text-slate-900">{user.name}</p>
              <p className="text-sm text-slate-500">Member since {memberSince}</p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Icon name="mail" className="h-4 w-4" />
                Email
              </dt>
              <dd className="mt-1 text-sm text-slate-800">{user.email}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Icon name="phone" className="h-4 w-4" />
                Phone
              </dt>
              <dd className="mt-1 text-sm text-slate-800">{user.phone}</dd>
            </div>
          </dl>

          <div className="mt-8 flex items-center gap-3 border-t border-slate-100 pt-6">
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
      </div>
    </Section>
  );
}
