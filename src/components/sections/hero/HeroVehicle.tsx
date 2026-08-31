"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { hasWebGL, prefersReducedMotion } from "@/lib/motion";

const VehicleScene = dynamic(() => import("@/components/3d/VehicleScene"), {
  ssr: false,
  loading: () => <PhotoFallback />,
});

/** Static premium shot — shown while 3D loads, and on reduced-motion / no-WebGL. */
function PhotoFallback() {
  return (
    <div className="absolute inset-0 [mask-image:radial-gradient(120%_120%_at_60%_45%,#000_55%,transparent_92%)]">
      <div className="absolute inset-x-[8%] bottom-[8%] h-16 rounded-[50%] bg-primary-500/40 blur-2xl" />
      <Image
        src="https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200&q=80"
        alt="Chauffeur-driven premium sedan"
        fill
        priority
        sizes="(max-width: 1024px) 90vw, 46vw"
        className="rounded-2xl object-cover shadow-[0_40px_80px_rgba(2,6,20,0.7)]"
      />
    </div>
  );
}

/**
 * Hero vehicle slot. Mounts the R3F scene only when it can pay off (WebGL +
 * motion allowed); otherwise a lit product shot. Same wrapper either way, so
 * the GSAP timeline treats it identically.
 */
export default function HeroVehicle({
  progressRef,
}: {
  progressRef: MutableRefObject<number>;
}) {
  const [use3d, setUse3d] = useState(false);

  useEffect(() => {
    // Phones get the lit photo — a WebGL hero car isn't worth the battery.
    const bigScreen = window.matchMedia("(min-width: 768px)").matches;
    setUse3d(bigScreen && !prefersReducedMotion() && hasWebGL());
  }, []);

  return (
    <div data-hero="vehicle" className="relative aspect-[16/11] w-full">
      {use3d ? (
        // If the WebGL scene throws at runtime (context lost, shader failure,
        // missing model), fall back to the same lit photo — never crash.
        <ErrorBoundary fallback={<PhotoFallback />}>
          <VehicleScene progressRef={progressRef} />
        </ErrorBoundary>
      ) : (
        <PhotoFallback />
      )}
    </div>
  );
}
