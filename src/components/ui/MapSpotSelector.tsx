"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Region, TouristSpot } from "@/types";

// ─── Canvas geometry ──────────────────────────────────────────────────────────

const CW = 620;
const CH = 480;
const CX = 310;   // horizontal center
const CY = 245;   // vertical center (slightly above midpoint for label room)
const CENTER_R = 50;
const SPOT_R = 36;
const ORBIT_R = 165;

// 5 angles (degrees) starting from top, evenly spaced clockwise
const ANGLES_DEG = [270, 342, 54, 126, 198];

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function getPos(i: number): { x: number; y: number } {
  const a = toRad(ANGLES_DEG[i] ?? 270 + i * 72);
  return { x: CX + ORBIT_R * Math.cos(a), y: CY + ORBIT_R * Math.sin(a) };
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface MapSpotSelectorProps {
  region: Region;
  selected: TouristSpot[];
  onToggle: (spot: TouristSpot) => void;
  maxSpots?: number;
}

export default function MapSpotSelector({
  region,
  selected,
  onToggle,
  maxSpots = 5,
}: MapSpotSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hovered = region.spots.find((s) => s.id === hoveredId) ?? null;

  return (
    <div className="w-full">
      {/* Header count */}
      <p className="mb-5 text-center text-sm text-slate-500">
        Hover a spot to preview · Click to select ·{" "}
        <span
          className={`font-semibold ${
            selected.length >= maxSpots ? "text-amber-600" : "text-blue-800"
          }`}
        >
          {selected.length}/{maxSpots} selected
        </span>
      </p>

      {/* ── SVG radial map ───────────────────────────────────────────────── */}
      <div className="mx-auto w-full" style={{ maxWidth: 640 }}>
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          className="w-full rounded-2xl shadow-card"
          style={{
            background:
              "linear-gradient(145deg,#eef2ff 0%,#f0fdf4 55%,#fefce8 100%)",
          }}
        >
          <defs>
            {/* Center clip */}
            <clipPath id="mc-center">
              <circle cx={CX} cy={CY} r={CENTER_R} />
            </clipPath>

            {/* Per-spot clip paths */}
            {region.spots.map((spot, i) => {
              const p = getPos(i);
              return (
                <clipPath key={spot.id} id={`mc-spot-${spot.id}`}>
                  <circle cx={p.x} cy={p.y} r={SPOT_R} />
                </clipPath>
              );
            })}
          </defs>

          {/* Decorative background rings */}
          <circle
            cx={CX}
            cy={CY}
            r={ORBIT_R * 1.42}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={0.8}
            strokeDasharray="3 10"
          />
          <circle
            cx={CX}
            cy={CY}
            r={ORBIT_R * 0.62}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={0.8}
            strokeDasharray="3 10"
          />

          {/* Orbit dashed ring */}
          <circle
            cx={CX}
            cy={CY}
            r={ORBIT_R}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={1.5}
            strokeDasharray="7 9"
          />

          {/* ── Animated connection lines ─────────────────────────────── */}
          {region.spots.map((spot, i) => {
            const p = getPos(i);
            const isSel = selected.some((s) => s.id === spot.id);
            return (
              <motion.path
                key={`line-${spot.id}`}
                d={`M ${CX} ${CY} L ${p.x} ${p.y}`}
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: isSel ? 1 : 0,
                  opacity: isSel ? 1 : 0,
                }}
                transition={{ duration: 0.42, ease: "easeOut" }}
              />
            );
          })}

          {/* Hover preview line (dashed grey) */}
          {hoveredId &&
            !selected.some((s) => s.id === hoveredId) &&
            (() => {
              const idx = region.spots.findIndex((s) => s.id === hoveredId);
              if (idx < 0) return null;
              const p = getPos(idx);
              return (
                <line
                  x1={CX}
                  y1={CY}
                  x2={p.x}
                  y2={p.y}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  opacity={0.55}
                />
              );
            })()}

          {/* ── Spot nodes ───────────────────────────────────────────────── */}
          {region.spots.map((spot, i) => {
            const p = getPos(i);
            const isSel = selected.some((s) => s.id === spot.id);
            const isHov = hoveredId === spot.id;
            const isDisabled = !isSel && selected.length >= maxSpots;
            const selIdx = selected.findIndex((s) => s.id === spot.id);

            return (
              <g
                key={spot.id}
                style={{ cursor: isDisabled ? "not-allowed" : "pointer" }}
                onMouseEnter={() => !isDisabled && setHoveredId(spot.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => !isDisabled && onToggle(spot)}
              >
                {/* Outer ring — colour/size animated */}
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={SPOT_R + 3}
                  initial={{ r: SPOT_R + 3, fill: "#ffffff", opacity: 1 }}
                  animate={{
                    r: isHov || isSel ? SPOT_R + 7 : SPOT_R + 3,
                    fill: isSel ? "#f59e0b" : isHov ? "#818cf8" : "#ffffff",
                    opacity: isDisabled ? 0.32 : 1,
                  }}
                  transition={{ duration: 0.18 }}
                />

                {/* Spot photo */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <image
                  href={spot.imageUrl}
                  x={p.x - SPOT_R}
                  y={p.y - SPOT_R}
                  width={SPOT_R * 2}
                  height={SPOT_R * 2}
                  clipPath={`url(#mc-spot-${spot.id})`}
                  preserveAspectRatio="xMidYMid slice"
                  style={{ opacity: isDisabled ? 0.38 : 1 }}
                />

                {/* Dark tint when un-selected */}
                {!isSel && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={SPOT_R}
                    fill={`rgba(15,23,42,${isHov ? 0.08 : 0.28})`}
                  />
                )}

                {/* Selection order badge */}
                {isSel && selIdx >= 0 && (
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                  >
                    <circle
                      cx={p.x + SPOT_R - 4}
                      cy={p.y - SPOT_R + 4}
                      r={11}
                      fill="#1e3a8a"
                    />
                    <text
                      x={p.x + SPOT_R - 4}
                      y={p.y - SPOT_R + 4}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10}
                      fontWeight="bold"
                      fill="white"
                    >
                      {selIdx + 1}
                    </text>
                  </motion.g>
                )}

                {/* Label */}
                <text
                  x={p.x}
                  y={p.y + SPOT_R + 18}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={isSel ? "bold" : "500"}
                  fill={isSel ? "#1e3a8a" : isHov ? "#4f46e5" : "#475569"}
                >
                  {spot.name}
                </text>
                <text
                  x={p.x}
                  y={p.y + SPOT_R + 32}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#94a3b8"
                >
                  {spot.tag}
                </text>
              </g>
            );
          })}

          {/* ── Centre region node (rendered last = on top) ──────────── */}
          <circle
            cx={CX}
            cy={CY}
            r={CENTER_R + 8}
            fill="white"
            style={{ filter: "drop-shadow(0 4px 16px rgba(30,58,138,0.2))" }}
          />
          <image
            href={region.imageUrl}
            x={CX - CENTER_R}
            y={CY - CENTER_R}
            width={CENTER_R * 2}
            height={CENTER_R * 2}
            clipPath="url(#mc-center)"
            preserveAspectRatio="xMidYMid slice"
          />
          <circle
            cx={CX}
            cy={CY}
            r={CENTER_R}
            fill="none"
            stroke="#1e3a8a"
            strokeWidth={3}
          />
          {/* Pulse ring for center */}
          <motion.circle
            cx={CX}
            cy={CY}
            r={CENTER_R + 10}
            fill="none"
            stroke="#1e3a8a"
            strokeWidth={1.5}
            initial={{ r: CENTER_R + 10, opacity: 0.4 }}
            animate={{ r: [CENTER_R + 10, CENTER_R + 22], opacity: [0.4, 0] }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeOut",
              repeatDelay: 0.6,
            }}
          />
          <text
            x={CX}
            y={CY + CENTER_R + 20}
            textAnchor="middle"
            fontSize={13}
            fontWeight="bold"
            fill="#1e3a8a"
          >
            {region.name}
          </text>
          <text
            x={CX}
            y={CY + CENTER_R + 35}
            textAnchor="middle"
            fontSize={10}
            fill="#94a3b8"
          >
            {region.state}
          </text>
        </svg>
      </div>

      {/* ── Hover info card / placeholder ─────────────────────────────────── */}
      <div className="mt-5 flex min-h-[5.5rem] items-center justify-center px-4">
        <AnimatePresence mode="wait">
          {hovered ? (
            <motion.div
              key={hovered.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex max-w-sm w-full items-start gap-3 rounded-xl border border-slate-100 bg-white px-5 py-3 shadow-card"
            >
              <div className="h-12 w-14 shrink-0 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hovered.imageUrl}
                  alt={hovered.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="font-display font-semibold text-slate-900">
                  {hovered.name}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {hovered.description}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-slate-400"
            >
              {selected.length === 0
                ? "Hover a spot to preview · Click to add to your package"
                : `${selected.length} spot${selected.length > 1 ? "s" : ""} added — you can select up to ${maxSpots}`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── Selected spot chips ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 flex flex-wrap justify-center gap-2 overflow-hidden"
          >
            {selected.map((spot, i) => (
              <motion.button
                key={spot.id}
                type="button"
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
                onClick={() => onToggle(spot)}
                title="Click to remove"
                className="group flex items-center gap-2 rounded-full bg-primary-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold">
                  {i + 1}
                </span>
                {spot.name}
                <span className="ml-0.5 opacity-50 group-hover:opacity-100">×</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
