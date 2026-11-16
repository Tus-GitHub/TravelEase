"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useTransition, type ComponentProps } from "react";

/** A single navigation with immediate feedback, preserving modified clicks and leave guards. */
export default function AdminNavigationLink({ href, children, onClick, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigating = useRef(false);
  return <Link {...props} href={href} aria-busy={pending || undefined} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === "_blank" || props.download) return;
    event.preventDefault();
    if (navigating.current || pending) return;
    navigating.current = true;
    startTransition(() => router.push(href));
    queueMicrotask(() => { navigating.current = false; });
  }}>{children}{pending && <span role="status" className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-xs"><span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" /><span className="sr-only">Opening page…</span></span>}</Link>;
}
