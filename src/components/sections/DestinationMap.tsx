"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/common/Button";
import Section from "@/components/common/Section";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { DURATION, EASE } from "@/lib/motion/presets";
import { vehicles } from "@/data/vehicles";
import {
  mapNodes,
  distanceKm,
  driveTime,
  type MapNode,
} from "@/data/destinations";

const INDIA_PATH =
  "M76 186 C82 126 118 90 156 76 C210 54 268 64 300 86 C330 106 356 116 380 124 C392 128 388 140 376 148 C350 162 330 212 316 266 C302 320 292 366 268 418 C246 466 224 492 212 492 C198 490 182 454 168 412 C148 354 132 298 118 250 C108 214 92 198 78 192 C72 188 74 190 76 186 Z";

/** A gently arced route between two nodes. */
function routeD(a: MapNode, b: MapNode) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(60, len * 0.28);
  const cx = mx - (dy / len) * bow;
  const cy = my + (dx / len) * bow;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

const minPrice = Math.min(...vehicles.map((v) => v.pricePerDay));

export default function DestinationMap() {
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduced = mounted && prefersReducedMotion();

  const [from, setFrom] = useState<MapNode>(
    () => mapNodes.find((n) => n.id === "delhi")!,
  );
  const [to, setTo] = useState<MapNode>(
    () => mapNodes.find((n) => n.id === "manali")!,
  );
  const [picking, setPicking] = useState<"from" | "to">("from");

  const route = useMemo(() => (from && to ? routeD(from, to) : ""), [from, to]);
  const km = from && to ? distanceKm(from, to) : 0;

  const pick = (node: MapNode) => {
    if (picking === "from") {
      setFrom(node);
      setPicking("to");
    } else {
      if (node.id === from.id) return;
      setTo(node);
      setPicking("from");
    }
  };

  useEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const el = root.current;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      gsap.from(q("[data-map='shape']"), {
        opacity: 0,
        scale: 0.9,
        duration: DURATION.reveal,
        ease: EASE.out,
        scrollTrigger: { trigger: el, start: "top 75%", once: true },
      });
      gsap.from(q("[data-map='node']"), {
        opacity: 0,
        scale: 0,
        transformOrigin: "center",
        duration: DURATION.ui,
        stagger: 0.06,
        ease: EASE.pop,
        scrollTrigger: { trigger: el, start: "top 70%", once: true },
      });
      gsap.from(q("[data-map='panel']"), {
        opacity: 0,
        x: 40,
        duration: DURATION.reveal,
        ease: EASE.out,
        scrollTrigger: { trigger: el, start: "top 70%", once: true },
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Section
      bg="primary"
      eyebrow="Explore India"
      title="Where will you go?"
      subtitle="Tap two cities to trace the route. Every journey is chauffeur-driven, door to door."
    >
      <div
        ref={root}
        className="grid items-center gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12"
      >
        {/* ── map ── */}
        <div className="relative mx-auto w-full max-w-md">
          <svg viewBox="0 0 440 520" className="w-full" role="img" aria-label="Map of India with destinations">
            <defs>
              <radialGradient id="landGlow" cx="50%" cy="42%" r="60%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                <stop offset="70%" stopColor="#1d4ed8" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
              </radialGradient>
              <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" />
              </filter>
            </defs>

            {/* faint grid */}
            <g stroke="#93c5fd" strokeOpacity="0.08">
              {Array.from({ length: 10 }).map((_, i) => (
                <line key={`v${i}`} x1={i * 48} y1="0" x2={i * 48} y2="520" />
              ))}
              {Array.from({ length: 11 }).map((_, i) => (
                <line key={`h${i}`} x1="0" y1={i * 52} x2="440" y2={i * 52} />
              ))}
            </g>

            <path d={INDIA_PATH} fill="url(#landGlow)" />
            <path
              data-map="shape"
              d={INDIA_PATH}
              fill="rgba(147,197,253,0.05)"
              stroke="#7dd3fc"
              strokeOpacity="0.5"
              strokeWidth="1.5"
            />

            {/* route */}
            {route && (
              <g key={`${from.id}-${to.id}`}>
                <path
                  d={route}
                  fill="none"
                  stroke="#fbbf24"
                  strokeOpacity="0.25"
                  strokeWidth="6"
                  filter="url(#soft)"
                />
                <path
                  d={route}
                  fill="none"
                  stroke="#fcd34d"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="1000"
                  strokeDashoffset={reduced ? "0" : "1000"}
                >
                  {!reduced && (
                    <animate
                      attributeName="stroke-dashoffset"
                      from="1000"
                      to="0"
                      dur="1.1s"
                      fill="freeze"
                    />
                  )}
                </path>
                {!reduced && (
                  <circle r="3.5" fill="#fffbeb">
                    <animateMotion dur="1.9s" repeatCount="indefinite" path={route} />
                  </circle>
                )}
              </g>
            )}

            {/* nodes */}
            {mapNodes.map((n) => {
              const active = n.id === from.id || n.id === to.id;
              return (
                <g
                  key={n.id}
                  data-map="node"
                  transform={`translate(${n.x} ${n.y})`}
                  className="cursor-pointer"
                  onClick={() => pick(n)}
                >
                  {active && !reduced && (
                    <circle r="10" fill="none" stroke="#fcd34d" strokeWidth="1.5">
                      <animate attributeName="r" from="6" to="16" dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.7" to="0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {active && reduced && (
                    <circle r="10" fill="none" stroke="#fcd34d" strokeWidth="1.5" strokeOpacity="0.4" />
                  )}
                  <circle r="4.5" fill={active ? "#fcd34d" : "#bfdbfe"} />
                  <circle r="9" fill="transparent" />
                  <text
                    x="0"
                    y="-12"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill={active ? "#fde68a" : "#dbeafe"}
                    className="pointer-events-none select-none"
                  >
                    {n.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── panel ── */}
        <div data-map="panel" className="text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
            {picking === "from" ? "Select your start" : "Select your destination"}
          </p>

          <div className="mt-3 flex items-center gap-3 font-display text-2xl font-bold">
            <span className={picking === "from" ? "text-accent-300" : ""}>{from.name}</span>
            <span className="text-white/30">→</span>
            <span className={picking === "to" ? "text-accent-300" : ""}>{to.name}</span>
          </div>
          <p className="mt-1 text-sm text-white/55">
            {from.state} to {to.name === to.state ? to.state : `${to.name}, ${to.state}`}
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-white/10 py-5">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-white/40">Distance</dt>
              <dd className="mt-1 font-display text-xl font-bold">{km.toLocaleString("en-IN")} km</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-white/40">By road</dt>
              <dd className="mt-1 font-display text-xl font-bold">~{driveTime(km)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-white/40">Fleet</dt>
              <dd className="mt-1 font-display text-xl font-bold">{vehicles.length} cars</dd>
            </div>
          </dl>

          <p className="mt-4 text-sm text-white/60">{to.blurb}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button href="/vehicles" variant="accent" size="md" iconRight="arrow-right">
              Vehicles from ₹{minPrice.toLocaleString("en-IN")}/day
            </Button>
            <Button href="/booking" variant="glass" size="md">
              Plan this trip
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
