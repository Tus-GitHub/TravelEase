"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MathUtils, type Group } from "three";
import VehicleModel from "./VehicleModel";
import VehicleEnvironment from "./VehicleEnvironment";
import { prefersReducedMotion } from "@/lib/motion";

interface Props {
  /** 0 → 1 hero-scroll progress, updated imperatively (no re-render). */
  progressRef: MutableRefObject<number>;
}

function Rig({ progressRef, reduced }: Props & { reduced: boolean }) {
  const car = useRef<Group>(null);

  useFrame((state, delta) => {
    const car0 = car.current;
    if (!car0) return;
    const p = progressRef.current;

    if (reduced) {
      car0.rotation.set(0, Math.PI * 0.16, 0);
      car0.position.set(0, -0.55, 0);
      state.camera.position.set(5.4, 1.7, 6);
      state.camera.lookAt(0, 0.4, 0);
      return;
    }

    // slow auto-rotate + subtle mouse parallax
    const targetY =
      Math.PI * 0.16 + state.clock.elapsedTime * 0.12 + state.pointer.x * 0.22;
    const targetX = -0.03 + state.pointer.y * 0.05;
    car0.rotation.y = MathUtils.damp(car0.rotation.y, targetY, 3, delta);
    car0.rotation.x = MathUtils.damp(car0.rotation.x, targetX, 3, delta);

    // scroll: ease forward + settle down
    car0.position.z = MathUtils.damp(car0.position.z, p * 1.8, 4, delta);
    car0.position.y = MathUtils.damp(car0.position.y, -0.55 - p * 0.2, 4, delta);

    // camera lifts + pulls in as you scroll
    state.camera.position.x = MathUtils.damp(state.camera.position.x, 5.4 - p * 1.4, 3, delta);
    state.camera.position.y = MathUtils.damp(state.camera.position.y, 1.7 + p * 1.4, 3, delta);
    state.camera.position.z = MathUtils.damp(state.camera.position.z, 6 - p * 0.6, 3, delta);
    state.camera.lookAt(0, 0.4, 0);
  });

  return <VehicleModel ref={car} />;
}

export default function VehicleScene({ progressRef }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const reduced = typeof window !== "undefined" && prefersReducedMotion();

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
        shadows
        dpr={[1, 1.75]}
        frameloop={visible && !reduced ? "always" : "demand"}
        camera={{ position: [5.4, 1.7, 6], fov: 40 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <VehicleEnvironment />
        <Rig progressRef={progressRef} reduced={reduced} />
      </Canvas>
    </div>
  );
}
