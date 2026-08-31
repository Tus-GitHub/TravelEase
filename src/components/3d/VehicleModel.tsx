"use client";

import { forwardRef } from "react";
import type { Group } from "three";

/**
 * PLACEHOLDER vehicle — a stylised low-poly sedan assembled from primitives.
 * Deliberately not a downloaded asset.
 *
 * To use a real model later, drop a compressed file at `public/models/car.glb`
 * and replace this component's body with:
 *
 *   import { useGLTF } from "@react-three/drei";
 *   const { scene } = useGLTF("/models/car.glb");
 *   return <primitive ref={ref} object={scene} dispose={null} />;
 *
 * The rest of the scene (camera, lights, shadows, scroll rig) stays the same.
 */
const PAINT = "#e6ebf5";
const GLASS = "#0d1524";
const CHROME = "#e9eefb";
const TYRE = "#121316";
const DARKTRIM = "#1a1d24";

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, -0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.36, 30]} />
        <meshStandardMaterial color={TYRE} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.19, 0]}>
        <cylinderGeometry args={[0.29, 0.29, 0.06, 22]} />
        <meshStandardMaterial color={CHROME} metalness={1} roughness={0.22} envMapIntensity={2} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.08, 16]} />
        <meshStandardMaterial color={DARKTRIM} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

const VehicleModel = forwardRef<Group>(function VehicleModel(_props, ref) {
  return (
    <group ref={ref} rotation={[0, Math.PI * 0.16, 0]} position={[0, -0.55, 0]} scale={1.05}>
      {/* main body */}
      <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[4.3, 0.5, 1.78]} />
        <meshStandardMaterial color={PAINT} metalness={0.5} roughness={0.3} envMapIntensity={1.7} />
      </mesh>
      {/* shoulder line / upper body */}
      <mesh castShadow receiveShadow position={[-0.1, 0.74, 0]}>
        <boxGeometry args={[3.7, 0.32, 1.68]} />
        <meshStandardMaterial color={PAINT} metalness={0.5} roughness={0.32} envMapIntensity={1.7} />
      </mesh>
      {/* cabin — low and blended */}
      <mesh castShadow receiveShadow position={[-0.35, 1.02, 0]}>
        <boxGeometry args={[2.0, 0.44, 1.5]} />
        <meshStandardMaterial color={PAINT} metalness={0.48} roughness={0.34} envMapIntensity={1.7} />
      </mesh>
      {/* glasshouse */}
      <mesh position={[-0.35, 1.04, 0]}>
        <boxGeometry args={[1.82, 0.36, 1.54]} />
        <meshStandardMaterial color={GLASS} metalness={0.35} roughness={0.06} envMapIntensity={1.6} />
      </mesh>
      {/* hood */}
      <mesh castShadow position={[1.65, 0.66, 0]} rotation={[0, 0, -0.05]}>
        <boxGeometry args={[1.3, 0.28, 1.66]} />
        <meshStandardMaterial color={PAINT} metalness={0.5} roughness={0.3} envMapIntensity={1.7} />
      </mesh>
      {/* boot */}
      <mesh castShadow position={[-1.85, 0.66, 0]} rotation={[0, 0, 0.04]}>
        <boxGeometry args={[0.9, 0.26, 1.66]} />
        <meshStandardMaterial color={PAINT} metalness={0.5} roughness={0.3} envMapIntensity={1.7} />
      </mesh>
      {/* lower valance / rocker */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[4.0, 0.24, 1.6]} />
        <meshStandardMaterial color={DARKTRIM} metalness={0.4} roughness={0.6} />
      </mesh>
      {/* fender arches */}
      {[
        [1.35, 0.92],
        [1.35, -0.92],
        [-1.45, 0.92],
        [-1.45, -0.92],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.3, z]}>
          <boxGeometry args={[1.25, 0.5, 0.2]} />
          <meshStandardMaterial color={DARKTRIM} metalness={0.35} roughness={0.65} />
        </mesh>
      ))}
      {/* headlights */}
      {[-0.62, 0.62].map((z) => (
        <mesh key={z} position={[2.28, 0.6, z]}>
          <boxGeometry args={[0.06, 0.14, 0.32]} />
          <meshStandardMaterial color="#eaf2ff" emissive="#dbe8ff" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}
      {/* tail lights */}
      {[-0.62, 0.62].map((z) => (
        <mesh key={z} position={[-2.28, 0.64, z]}>
          <boxGeometry args={[0.05, 0.12, 0.3]} />
          <meshStandardMaterial color="#ff6b6b" emissive="#ef4444" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      ))}
      <Wheel x={1.4} z={0.95} />
      <Wheel x={1.4} z={-0.95} />
      <Wheel x={-1.5} z={0.95} />
      <Wheel x={-1.5} z={-0.95} />

      {/* cool underglow */}
      <pointLight position={[0, 0.0, 0]} intensity={7} distance={4.5} color="#3b82f6" />
    </group>
  );
});

export default VehicleModel;
