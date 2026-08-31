"use client";

import { type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";

interface CameraRigProps {
  /** 0 → 1 hero-scroll progress, read imperatively (no re-render). */
  progressRef: MutableRefObject<number>;
  reduced: boolean;
  /** Lower amplitude on small screens. */
  mobile?: boolean;
}

/**
 * Drives the scene camera: a settled 3/4 framing that lifts and pulls in as the
 * hero scrolls away, plus a whisper of pointer parallax. No state, no re-renders.
 */
export default function CameraRig({ progressRef, reduced, mobile = false }: CameraRigProps) {
  useFrame((state, delta) => {
    const cam = state.camera;
    const p = progressRef.current;

    if (reduced) {
      cam.position.set(5.4, 1.7, 6);
      cam.lookAt(0, 0.4, 0);
      return;
    }

    const par = mobile ? 0 : 0.18;
    const lift = mobile ? 0.8 : 1.4;

    cam.position.x = MathUtils.damp(cam.position.x, 5.4 - p * lift + state.pointer.x * par, 3, delta);
    cam.position.y = MathUtils.damp(cam.position.y, 1.7 + p * lift - state.pointer.y * par, 3, delta);
    cam.position.z = MathUtils.damp(cam.position.z, 6 - p * 0.6, 3, delta);
    cam.lookAt(0, 0.4, 0);
  });

  return null;
}
