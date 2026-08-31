"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";

/**
 * Lighting + reflections + grounding for the vehicle. All procedural — no
 * external HDR fetch. The canvas itself stays transparent so it blends with
 * the DOM hero backdrop. Swappable independently of the model.
 */
export default function VehicleEnvironment() {
  return (
    <>
      <hemisphereLight intensity={0.6} color="#cfe0ff" groundColor="#0a1020" />
      <ambientLight intensity={0.5} />

      {/* key light — casts the car's shadow */}
      <directionalLight
        position={[6, 9, 5]}
        intensity={3.2}
        color="#eef3ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      >
        <orthographicCamera attach="shadow-camera" args={[-8, 8, 8, -8, 0.1, 30]} />
      </directionalLight>

      {/* warm rim from the far side */}
      <directionalLight position={[-7, 4, -6]} intensity={1.8} color="#ffd7a1" />
      {/* cool fill from the front */}
      <directionalLight position={[0, 2, 9]} intensity={1.1} color="#9dc0ff" />

      {/* procedural reflections for the paint / glass */}
      <Environment resolution={256}>
        <Lightformer
          form="rect"
          intensity={3}
          color="#dbe8ff"
          position={[0, 6, -7]}
          scale={[12, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          color="#ffffff"
          position={[7, 3, 5]}
          scale={[5, 8, 1]}
        />
        <Lightformer
          form="circle"
          intensity={2.2}
          color="#ffca7a"
          position={[-7, 2, 4]}
          scale={[4, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#89b4ff"
          position={[0, -3, 6]}
          scale={[10, 3, 1]}
        />
      </Environment>

      <ContactShadows
        position={[0, -0.98, 0]}
        opacity={0.55}
        scale={16}
        blur={2.8}
        far={5}
        resolution={512}
        color="#02040c"
      />
    </>
  );
}
