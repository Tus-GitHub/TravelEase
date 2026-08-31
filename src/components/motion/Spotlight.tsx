"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Subtle cursor spotlight for framed content — images, showcase cards (§19).
 * Sets CSS custom props the `.pointer-spot` overlay reads; the overlay is a
 * sibling `<span>` so it never intercepts clicks. Mouse-only; a no-op under
 * reduced motion (the attribute is simply never set).
 *
 * The nearest ancestor with `overflow-hidden` clips the glow.
 */
export default function Spotlight({
  children,
  className = "",
  /** Diameter of the highlight in px. */
  size = 220,
}: {
  children: ReactNode;
  className?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--spot-x", `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty("--spot-y", `${((e.clientY - r.top) / r.height) * 100}%`);
        if (el.dataset.spot !== "on") el.dataset.spot = "on";
      }}
      onPointerLeave={() => {
        if (ref.current) ref.current.dataset.spot = "off";
      }}
      className={`relative ${className}`}
      style={{ "--spot-size": `${size}px` } as CSSProperties}
    >
      {children}
      <span className="pointer-spot" aria-hidden />
    </div>
  );
}
