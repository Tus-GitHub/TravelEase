"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/components/common/Section";
import Button from "@/components/common/Button";
import Select from "@/components/controls/Select";
import PackageCard from "@/components/cards/PackageCard";
import { cmsHeading, type CmsSection } from "@/lib/cms";
import { mapNodes } from "@/data/destinations";
import { INDIA_MAINLAND, INDIA_ISLANDS, projectIndia as project, type MapPoint as Point } from "@/data/india-map";
import { geographyKey } from "@/lib/geography";
import type { Region, TouristSpot, TravelPackage } from "@/types";
import styles from "./DestinationMap.module.css";

const compass: Record<string, Point> = {
  north: project(78, 31), south: project(77, 13), east: project(87, 24),
  west: project(72, 23), central: project(78, 23), northeast: project(94, 26),
};
const landMotion = { still: { pathLength: 1, opacity: 1 }, enter: { pathLength: [0, 1], opacity: [.3, 1] } };
const pinMotion = { still: { opacity: 1, y: 0 }, enter: (scale: number) => ({ opacity: [0, 1], y: [8 * scale, 0] }) };
function spotPoint(spot: TouristSpot): Point | null {
  return typeof spot.latitude === "number" && typeof spot.longitude === "number" &&
    Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude) &&
    spot.latitude >= 6 && spot.latitude <= 38 && spot.longitude >= 67 && spot.longitude <= 99
    ? project(spot.longitude, spot.latitude) : null;
}
function regionPoint(region: Region): Point | null {
  const points = region.spots.map(spotPoint).filter((p): p is Point => p !== null);
  if (points.length) return { x: points.reduce((n, p) => n + p.x, 0) / points.length, y: points.reduce((n, p) => n + p.y, 0) / points.length };
  const key = geographyKey(region.name).replace(/[-\s]/g, "").replace(/india$/, "");
  if (compass[key]) return compass[key];
  const known = mapNodes.find(node => geographyKey(node.name) === geographyKey(region.name) || geographyKey(node.state) === geographyKey(region.state));
  return known ? project(known.lng, known.lat) : null;
}

export default function DestinationMap({ cms, regions = [], packages = [] }: { cms?: CmsSection; regions?: Region[]; packages?: TravelPackage[] } = {}) {
  const id = useId(), root = useRef<HTMLDivElement>(null), reduced = useReducedMotion();
  const [ready, setReady] = useState(false), [visible, setVisible] = useState(false);
  const [regionId, setRegionId] = useState(""), [spotId, setSpotId] = useState(""), [previewId, setPreviewId] = useState(""), [query, setQuery] = useState("");
  useEffect(() => {
    setReady(true);
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting ?? false), { rootMargin: "100px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const region = regions.find(item => item.id === regionId);
  const spot = region?.spots.find(item => item.id === spotId);
  const animated = ready && visible && !reduced;
  const points = region?.spots.map(spotPoint).filter((point): point is Point => point !== null) ?? [];
  const box = points.length ? (() => {
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const width = Math.max(180, (Math.max(...xs) - Math.min(...xs)) * 1.8, (Math.max(...ys) - Math.min(...ys)) * 1.8 * 440 / 520);
    const height = width * 520 / 440;
    return { x: (Math.min(...xs) + Math.max(...xs) - width) / 2, y: (Math.min(...ys) + Math.max(...ys) - height) / 2, width, height };
  })() : { x: 0, y: 0, width: 440, height: 520 };
  const scale = box.width / 440;
  // Spread close pins on this illustrated map; faint leaders retain their real
  // anchors. This never changes catalogue coordinates or booking route distances.
  const destinations = useMemo(() => {
    const nodes = (region?.spots.slice(0, 30) ?? []).flatMap(item => {
      const anchor = spotPoint(item);
      return anchor ? [{ item, anchor, point: { ...anchor } }] : [];
    });
    for (let pass = 0; pass < 24; pass++) {
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].point, b = nodes[j].point;
        const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
        if (distance >= 82 * scale) continue;
        const angle = distance > .001 ? Math.atan2(dy, dx) : (i + j) * 2.4;
        const shift = (82 * scale - distance) / 2;
        a.x -= Math.cos(angle) * shift; a.y -= Math.sin(angle) * shift;
        b.x += Math.cos(angle) * shift; b.y += Math.sin(angle) * shift;
      }
      for (const node of nodes) {
        node.point.x = Math.max(box.x + 42 * scale, Math.min(box.x + box.width - 42 * scale, node.point.x));
        node.point.y = Math.max(box.y + 42 * scale, Math.min(box.y + box.height - 42 * scale, node.point.y));
      }
    }
    return nodes;
  }, [region, scale, box.x, box.y, box.width, box.height]);
  const shownRegions = regions.filter(item => `${item.name} ${item.state} ${item.spots.map(s => `${s.name} ${s.cityName ?? ""}`).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const matching = packages.filter(pkg => (!region || (pkg.regionId !== undefined ? String(pkg.regionId) === region.id : pkg.region === region.name)) && (!spot || pkg.destinationIds?.includes(Number(spot.id))));
  const start = region ? regionPoint(region) : null, end = spot ? destinations.find(node => node.item.id === spot.id)?.point ?? spotPoint(spot) : null;
  const path = start && end && Math.hypot(start.x - end.x, start.y - end.y) > .01
    ? `M${start.x} ${start.y} Q${(start.x + end.x) / 2 + 24 * scale} ${(start.y + end.y) / 2 - 30 * scale} ${end.x} ${end.y}` : "";
  const previewRegion = regions.find(item => item.id === previewId);
  const highlight = region ? regionPoint(region) : previewRegion ? regionPoint(previewRegion) : null;
  const lightSurface = ["light", "muted"].includes(cms?.appearance.background ?? "default");
  const customBackground = lightSurface || cms?.appearance.background === "image" ? "" : styles.section;

  function chooseRegion(value: string) { setRegionId(value); setSpotId(""); setPreviewId(""); }
  function marker(point: Point, label: string, name: string, selected: boolean, onPick: () => void, index: number, preview = "") {
    const active = selected || (preview !== "" && preview === previewId);
    return <g role="button" tabIndex={ready ? 0 : -1} aria-disabled={!ready} aria-label={label} aria-pressed={selected}
      onClick={() => { if (ready) onPick(); }}
      onKeyDown={event => { if (ready && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onPick(); } }}
      onMouseEnter={() => setPreviewId(preview)} onMouseLeave={() => setPreviewId("")}
      onFocus={() => setPreviewId(preview)} onBlur={() => setPreviewId("")}
      className={styles.marker} transform={`translate(${point.x} ${point.y})`}>
      <title>{name}</title>
      <circle r={38 * scale} fill="transparent" />
      <motion.g initial={false} custom={scale} variants={pinMotion} animate={animated ? "enter" : "still"} transition={{ duration: .45, delay: Math.min(index, 8) * .06 }}>
        <circle r={(active ? 20 : 14) * scale} fill={active ? "#fbbf24" : "#7dd3fc"} fillOpacity={active ? .14 : .07} />
        <circle className={styles.focusRing} r={17 * scale} fill="none" stroke="#fff7d6" strokeWidth={1.5 * scale} />
        {selected && animated && <circle key={`${regionId}-${spotId}`} r={12 * scale} fill="none" stroke="#fcd34d" strokeWidth={scale}>
          <animate attributeName="r" from={12 * scale} to={29 * scale} dur="1.4s" repeatCount="2" fill="freeze" />
          <animate attributeName="opacity" from=".75" to="0" dur="1.4s" repeatCount="2" fill="freeze" />
        </circle>}
        <circle className={styles.pin} r={(active ? 7 : 5) * scale} fill={active ? "#fbbf24" : "#bae6fd"} stroke={active ? "#fff1b6" : "#123353"} strokeWidth={2 * scale} />
        <text y={-23 * scale} textAnchor="middle" fill={active ? "#fde68a" : "#e0f2fe"} fontSize={12 * scale} strokeWidth={4 * scale} fontWeight="600" className={styles.label}>{name.length > 22 ? name.slice(0, 20) + "…" : name}</text>
      </motion.g>
    </g>;
  }

  return <Section bg="primary" eyebrow="Explore India" title="Find a place. Discover your trip." subtitle="Choose a region or destination to see its packages, or start creating your own itinerary." className={customBackground} {...cmsHeading(cms)}>
    <div ref={root} className={`${lightSurface ? "" : "cms-dark"} grid items-start gap-7 lg:grid-cols-[1fr_1.05fr] lg:gap-12`} data-destination-explorer data-ready={ready}>
      <div className={`${styles.mapCard} relative mx-auto w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-sky-200/15 p-4 sm:p-5`}>
        <div className="flex min-h-11 items-center justify-between gap-3 px-1 text-white">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.25em] text-sky-200/60">Your journey starts here</p><p className="mt-1 text-sm font-semibold">{region ? region.name + " India" : "A whole country to explore"}</p></div>
          <button data-ui-action="" type="button" disabled={!ready || !region} onClick={() => chooseRegion("")} className="min-h-11 shrink-0 rounded-full border border-white/15 px-3 text-xs font-semibold text-sky-100 transition-colors hover:border-sky-200/40 disabled:cursor-default disabled:text-sky-200/40">{region ? "← All India" : "India"}</button>
        </div>
        <motion.svg initial={false} animate={{ viewBox: `${box.x} ${box.y} ${box.width} ${box.height}` }} transition={{ duration: animated ? .55 : 0, ease: [.22, 1, .36, 1] }} role="group" aria-label="Interactive India destination map" className={`${styles.map} aspect-[440/520] w-full`}>
          <defs>
            <radialGradient id={`${id}-land`} cx=".35" cy=".3" r=".85"><stop stopColor="#276a91" stopOpacity=".65" /><stop offset="1" stopColor="#123353" stopOpacity=".4" /></radialGradient>
            <radialGradient id={`${id}-highlight`}><stop stopColor="#fbbf24" stopOpacity=".3" /><stop offset="1" stopColor="#fbbf24" stopOpacity="0" /></radialGradient>
            <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#bae6fd" /><stop offset=".45" stopColor="#38bdf8" /><stop offset="1" stopColor="#7dd3fc" stopOpacity=".3" /></linearGradient>
            <linearGradient id={`${id}-shine`}><stop stopColor="#bae6fd" stopOpacity="0" /><stop offset=".5" stopColor="#bae6fd" stopOpacity=".12" /><stop offset="1" stopColor="#bae6fd" stopOpacity="0" /></linearGradient>
            <pattern id={`${id}-grid`} width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#bae6fd" fillOpacity=".12" /></pattern>
            <clipPath id={`${id}-clip`}><path d={INDIA_MAINLAND} /></clipPath>
          </defs>
          <g aria-hidden="true" pointerEvents="none">
            <rect width="440" height="520" fill={`url(#${id}-grid)`} />
            <circle cx="205" cy="245" r="194" fill="none" stroke="#93c5fd" strokeOpacity=".07" />
            <circle cx="205" cy="245" r="145" fill="none" stroke="#93c5fd" strokeOpacity=".05" />
            <path d={INDIA_MAINLAND} fill={`url(#${id}-land)`} stroke="#38bdf8" strokeOpacity=".08" strokeWidth={14 * scale} className={styles.land} />
            <motion.path d={INDIA_MAINLAND} fill="none" stroke={`url(#${id}-edge)`} strokeWidth={1.6 * scale} className={styles.land} initial={false} variants={landMotion} animate={animated ? "enter" : "still"} transition={{ duration: 1.5, ease: "easeInOut" }} />
            {INDIA_ISLANDS.map((island, index) => <path key={index} d={island} fill="none" stroke="#7dd3fc" strokeOpacity=".7" strokeWidth={2 * scale} className={styles.land} />)}
            <g clipPath={`url(#${id}-clip)`}>
              {highlight && <circle cx={highlight.x} cy={highlight.y} r={95 * scale} fill={`url(#${id}-highlight)`} />}
              {animated && <rect x="-120" y="0" width="110" height="520" fill={`url(#${id}-shine)`}><animate attributeName="x" from="-120" to="440" dur="2.8s" repeatCount="1" fill="freeze" /></rect>}
            </g>
            {!region && <g fill="#7da1c4" fontSize="10" fontWeight="500" letterSpacing="2" opacity=".55"><text x="32" y="372" transform="rotate(-12 32 372)">ARABIAN SEA</text><text x="292" y="353" transform="rotate(12 292 353)">BAY OF BENGAL</text></g>}
          </g>
          {path && <g key={`${regionId}-${spotId}`} aria-hidden="true" pointerEvents="none">
            <path d={path} fill="none" stroke="#fbbf24" strokeOpacity=".12" strokeWidth={8 * scale} />
            <path d={path} fill="none" stroke="#fcd34d" strokeWidth={2 * scale} strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="0">{animated && <animate attributeName="stroke-dashoffset" from="1" to="0" dur=".8s" fill="freeze" />}</path>
            {animated && <circle r={3.5 * scale} fill="#fff7d6"><animateMotion path={path} dur="1.5s" repeatCount="2" fill="freeze" /></circle>}
          </g>}
          {!points.length && regions.map((item, index) => { const point = regionPoint(item); return point ? <g key={item.id}>{marker(point, `Explore region ${item.name}`, item.name, item.id === regionId, () => chooseRegion(item.id), index, item.id)}</g> : null; })}
          <g aria-hidden="true" pointerEvents="none">{destinations.filter(node => Math.hypot(node.point.x - node.anchor.x, node.point.y - node.anchor.y) > 4 * scale).map(node => <g key={node.item.id}><path d={`M${node.anchor.x} ${node.anchor.y} L${node.point.x} ${node.point.y}`} stroke="#bae6fd" strokeOpacity=".25" strokeWidth={scale} strokeDasharray={`${3 * scale} ${4 * scale}`} /><circle cx={node.anchor.x} cy={node.anchor.y} r={2 * scale} fill="#bae6fd" fillOpacity=".6" /></g>)}</g>
          {destinations.map(({ item, point }, index) => <g key={item.id}>{marker(point, `Explore destination ${item.name}`, item.name, item.id === spotId, () => setSpotId(item.id), index)}</g>)}
        </motion.svg>
        <div className="flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-xs text-sky-100/70"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />{region ? "Pick a destination to discover its packages" : "Tap a region to start exploring"}</div>
        <p className="mt-3 text-center text-[10px] leading-relaxed text-sky-100/45">Stylised travel map · Markers are approximate. All destinations are available in the lists.</p>
      </div>

      <div className="min-w-0 space-y-5 lg:py-2">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-accent-400">Make it your kind of trip</p><h3 className="mt-2 font-display text-2xl font-bold text-fg sm:text-3xl">{region ? `Explore ${region.name}` : "Where do you want to go?"}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{region ? region.state : "Mountains, coastlines and everything in between. Choose your part of India."}</p></div>
        <label className="block text-sm font-semibold text-fg">Find a region or place<input disabled={!ready} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Start typing a region or destination…" className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base font-normal text-fg focus:border-accent-500" /></label>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Explore regions">{shownRegions.map(item => <button data-ui-action="" key={item.id} type="button" disabled={!ready} aria-pressed={regionId === item.id} onClick={() => chooseRegion(item.id)} onMouseEnter={() => setPreviewId(item.id)} onMouseLeave={() => setPreviewId("")} onFocus={() => setPreviewId(item.id)} onBlur={() => setPreviewId("")} className={`${styles.regionButton} flex min-h-14 items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${regionId === item.id ? "border-accent-400 bg-accent-500 text-primary-950" : "border-line bg-surface text-fg hover:border-accent-400/60"}`}><span className="min-w-0 break-words">{item.name}</span><span aria-hidden="true" className={regionId === item.id ? "text-primary-950" : "text-accent-400"}>{regionId === item.id ? "✓" : "↗"}</span></button>)}</div>
        {!shownRegions.length && <p role="status" className="text-sm text-muted">No published regions match yet.</p>}
        {region && <label className="block text-sm font-semibold text-fg">Destination in {region.name}<Select aria-label={`Destination in ${region.name}`} searchable value={spotId} onChange={event => setSpotId(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-base font-normal text-fg"><option value="">All destinations</option>{region.spots.map(item => <option key={item.id} value={item.id}>{item.name}{item.stateName ? ` · ${item.stateName}` : ""}</option>)}</Select></label>}
        <div className="border-t border-line pt-5" aria-live="polite"><h3 className="text-xl font-semibold text-fg">{spot ? `Packages for ${spot.name}` : region ? `Packages in ${region.name}` : "Explore published packages"}</h3><p className="mt-1 text-sm text-muted">{matching.length} published {matching.length === 1 ? "package" : "packages"}</p></div>
        {!!matching.length && <div className="grid gap-4 sm:grid-cols-2">{matching.slice(0, 4).map(pkg => <PackageCard key={pkg.id} pkg={pkg} />)}</div>}
        {!matching.length && <p className="rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted">No ready-made package is published for this selection yet. You can shape your own route from available destinations.</p>}
        <div className="flex flex-wrap gap-3"><Button href={`/booking?mode=custom${region ? `&region=${encodeURIComponent(region.id)}` : ""}${spot ? `&spot=${encodeURIComponent(spot.id)}` : ""}`} variant="accent" iconRight="arrow-right">Create your package</Button><Button href="/packages" variant={lightSurface ? "outline" : "glass"}>All packages</Button></div>
      </div>
    </div>
  </Section>;
}
