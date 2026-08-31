"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MathUtils, type Group } from "three";
import VehicleModel from "./VehicleModel";
import VehicleEnvironment from "./VehicleEnvironment";
import CameraRig from "./CameraRig";
import { prefersReducedMotion } from "@/lib/motion";

interface Props {
  /** 0 → 1 hero-scroll progress, updated imperatively (no re-render). */
  progressRef: MutableRefObject<number>;
}

/** Rotates/settles the car itself; the camera is handled by <CameraRig>. */
function VehicleRig({
  progressRef,
  reduced,
  mobile,
}: Props & { reduced: boolean; mobile: boolean }) {
  const car = useRef<Group>(null);

  useFrame((state, delta) => {
    const car0 = car.current;
    if (!car0) return;
    const p = progressRef.current;

    if (reduced) {
      car0.rotation.set(0, Math.PI * 0.16, 0);
      car0.position.set(0, -0.55, 0);
      return;
    }

    const mouse = mobile ? 0 : 1;
    const targetY =
      Math.PI * 0.16 + state.clock.elapsedTime * 0.12 + state.pointer.x * 0.22 * mouse;
    const targetX = -0.03 + state.pointer.y * 0.05 * mouse;
    car0.rotation.y = MathUtils.damp(car0.rotation.y, targetY, 3, delta);
    car0.rotation.x = MathUtils.damp(car0.rotation.x, targetX, 3, delta);

    car0.position.z = MathUtils.damp(car0.position.z, p * 1.8, 4, delta);
    car0.position.y = MathUtils.damp(car0.position.y, -0.55 - p * 0.2, 4, delta);
  });

  return <VehicleModel ref={car} />;
}

export default function VehicleScene({ progressRef }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const reduced = typeof window !== "undefined" && prefersReducedMotion();
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="h-full w-full">
      <Canvas
        shadows={!mobile}
        dpr={[1, mobile ? 1.25 : 1.75]}
        frameloop={visible && !reduced ? "always" : "demand"}
        camera={{ position: [5.4, 1.7, 6], fov: 40 }}
        gl={{ antialias: !mobile, powerPreference: "high-performance" }}
      >
        <VehicleEnvironment mobile={mobile} />
        <CameraRig progressRef={progressRef} reduced={reduced} mobile={mobile} />
        <VehicleRig progressRef={progressRef} reduced={reduced} mobile={mobile} />
      </Canvas>
    </div>
  );
}
