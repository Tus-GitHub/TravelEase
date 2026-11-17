"use client";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { RouteTree } from "@/lib/package-content";
import { layoutRoutePreview, ROUTE_CARD } from "@/lib/route-preview";
import Button from "@/components/common/Button";
import styles from "./RouteTreePreview.module.css";

export default function RouteTreePreview({
  tree,
  names,
  images,
  suggestionsOnly = false,
}: {
  tree: RouteTree;
  names: Map<number, string>;
  images?: Map<number, string>;
  suggestionsOnly?: boolean;
}) {
  const marker = useId().replace(/[^a-zA-Z0-9]/g, "") + "-route-arrow";
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const layout = useMemo(() => layoutRoutePreview(tree), [tree]);
  const byId = useMemo(() => new Map(layout.nodes.map(node => [node.id, node])), [layout]);
  const selected = selectedId == null ? undefined : byId.get(selectedId);
  const label = (id: number) => names.get(id) ?? "Unavailable destination";
  const fit = useCallback(() => {
    if (!viewport.current) return;
    setZoom(Math.max(.35, Math.min(1, (viewport.current.clientWidth - 24) / layout.width, (viewport.current.clientHeight - 24) / layout.height)));
    viewport.current.scrollTo({ left: 0, top: 0 });
  }, [layout.width, layout.height]);
  return <div className="min-w-0 rounded-3xl border border-amber-400/20 bg-surface-muted p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4 className="font-display text-lg font-semibold text-fg">Route tree preview</h4>
        <p className="mt-1 text-sm leading-relaxed text-muted">Each destination appears once with its city photo. Click any stop to highlight its incoming and onward connections.</p>
      </div>
      {tree.nodes.length > 0 && (
        <div role="group" aria-label="Route preview zoom" className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={zoom <= .25} onClick={() => setZoom(value => Math.max(.25, value - .25))} aria-label="Zoom out route preview">−</Button>
          <span className="min-w-12 text-center text-sm tabular-nums text-fg" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" disabled={zoom >= 1.5} onClick={() => setZoom(value => Math.min(1.5, value + .25))} aria-label="Zoom in route preview">+</Button>
          <Button variant="outline" size="sm" onClick={fit}>Fit</Button>
          <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setSelectedId(null); }}>Reset</Button>
        </div>
      )}
    </div>
    {tree.nodes.length ? <>
      {layout.hasCycle && <p role="status" className="mt-3 text-sm text-red-600 dark:text-red-300">Remove loops before saving this route.</p>}
      <div
        ref={viewport}
        tabIndex={0}
        aria-label="Route tree preview"
        role="region"
        style={{
          height: Math.min(680, Math.max(420, layout.height * zoom + 24)),
          backgroundImage: "radial-gradient(rgb(245 158 11 / 0.14) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        className="mt-4 max-h-[72vh] max-w-full overflow-auto overscroll-contain rounded-2xl border border-amber-400/20 bg-[#070b14] p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      >
        <div className={styles.scaled} style={{ width: layout.width * zoom, height: layout.height * zoom }}>
          <div className={styles.canvas} style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
            <svg width={layout.width} height={layout.height} aria-hidden="true" className={styles.connectors}>
              <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" /></marker></defs>
              {layout.edges.map(edge => {
                const highlighted = !selected || edge.from === selected.id || edge.to === selected.id;
                return <path key={`${edge.from}-${edge.to}`} data-route-edge={`${edge.from}-${edge.to}`} d={edge.path} fill="none" stroke={highlighted ? "#f59e0b" : "#94a3b8"} strokeWidth={!selected ? 2 : highlighted ? 2.8 : 1} opacity={highlighted ? .9 : .18} markerEnd={`url(#${marker})`} />;
              })}
            </svg>
            <ul className={styles.nodes}>{layout.nodes.map(({ id, node, x, y, parents }) => {
              const photo = images?.get(id);
              const isRoot = tree.roots.includes(id);
              const isSelected = selectedId === id;
              return <li key={id} data-route-node={id} style={{ left: x, top: y, width: ROUTE_CARD.width, height: ROUTE_CARD.height }} className={styles.node}>
                <button
                  type="button"
                  data-ui-action=""
                  aria-label={`Inspect connections for ${label(id)}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(current => current === id ? null : id)}
                  className={`group relative h-full w-full overflow-hidden rounded-2xl border text-left shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                    isSelected
                      ? "border-amber-400 ring-2 ring-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.35)]"
                      : isRoot
                        ? "border-amber-400/60"
                        : "border-white/15 hover:border-amber-400/50"
                  } bg-[#0d1322] text-white`}
                >
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className={`absolute inset-0 ${photo ? "bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-slate-950/25" : "bg-gradient-to-br from-[#0f172a] to-[#070b14]"}`} />
                  <div className="relative z-10 flex h-full flex-col justify-between p-3">
                    <div className="flex items-center justify-between gap-1">
                      {isRoot ? (
                        <span className="rounded-full border border-amber-400/50 bg-amber-400/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200 backdrop-blur-sm">
                          Start
                        </span>
                      ) : parents.length > 1 ? (
                        <span className="rounded-full border border-white/20 bg-slate-950/60 px-2 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm">
                          {parents.length} routes join
                        </span>
                      ) : <span />}
                      {node.canFinish && (
                        <span className="rounded-full bg-slate-950/60 px-1.5 py-0.5 text-[9px] text-white/75 backdrop-blur-sm">
                          End ok
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="line-clamp-2 block font-display text-sm font-bold leading-snug text-white drop-shadow-sm">
                        {label(id)}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-medium text-amber-200/85">
                        {suggestionsOnly
                          ? `${node.next.length} next ${node.next.length === 1 ? "stop" : "stops"}`
                          : `${node.nights} ${node.nights === 1 ? "night" : "nights"} · +₹${node.extraPricePerPerson.toLocaleString("en-IN")}`}
                      </span>
                    </div>
                  </div>
                </button>
              </li>;
            })}</ul>
          </div>
        </div>
      </div>
      {selected && (
        <p role="status" className="mt-3 rounded-xl border border-amber-400/25 bg-surface px-4 py-2.5 text-sm leading-relaxed text-fg">
          <strong className="text-amber-400">{label(selected.id)}</strong> · Arrives from:{" "}
          {selected.parents.map(label).join(", ") || "Starting point"} · Next:{" "}
          {selected.node.next.map(label).join(", ") || "End of route"}
        </p>
      )}
    </> : <p className="mt-4 text-sm text-muted">Add a destination and mark a starting point to see your route.</p>}
  </div>;
}
