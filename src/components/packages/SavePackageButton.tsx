"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import { useAuth } from "@/context/AuthContext";

/**
 * "Save for later" on a curated package page (Phase 3, saved itineraries).
 * Guests are sent to sign in and back; signed-in users get one POST to
 * /api/saved-itineraries and a link to their profile.
 */
export default function SavePackageButton({
  packageId,
  packageName,
  packageSlug,
}: {
  packageId: number;
  packageName: string;
  packageSlug: string;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        Saved —{" "}
        <Link href="/profile/saved" className="hover-underline">
          view saved trips
        </Link>
      </span>
    );
  }

  const save = async () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/packages/${packageSlug}`)}`);
      return;
    }
    setState("saving");
    try {
      const res = await fetch("/api/saved-itineraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "curated", packageId, title: packageName }),
      });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="lg"
        iconLeft="bookmark"
        onClick={save}
        disabled={state === "saving" || isLoading}
      >
        {state === "saving" ? "Saving…" : user ? "Save for later" : "Sign in to save"}
      </Button>
      {state === "error" && (
        <span className="text-xs text-red-600 dark:text-red-400">
          Couldn&apos;t save. Try again.
        </span>
      )}
    </div>
  );
}
