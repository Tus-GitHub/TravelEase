"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { RouteTree } from "@/lib/package-content";
import { layoutRoutePreview, ROUTE_CARD } from "@/lib/route-preview";
import Button from "@/components/common/Button";
import styles from "./RouteTreePreview.module.css";

export default function RouteTreePreview({ tree, names, suggestionsOnly = false }: { tree: RouteTree; names: Map<number, string>; suggestionsOnly?: boolean }) {
  const marker = useId().replace(/[^a-zA-Z0-9]/g, "") + "-route-arrow";
  const viewport = useRef<HTMLDivElement>(null);
  const fitted = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const layout = useMemo(() => layoutRoutePreview(tree), [tree]);
  const byId = useMemo(() => new Map(layout.nodes.map(node => [node.id, node])), [layout]);
  const selected = selectedId == null ? undefined : byId.get(selectedId);
  const label = (id: number) => names.get(id) ?? "Unavailable destination";
  const fit = useCallback(() => {
    if (!viewport.current) return;
    setZoom(Math.max(.25, Math.min(1, (viewport.current.clientWidth - 24) / layout.width, (viewport.current.clientHeight - 24) / layout.height)));
    viewport.current.scrollTo({ left: 0, top: 0 });
  }, [layout.width, layout.height]);
  useEffect(() => {
    if (fitted.current || !tree.nodes.length) return;
    fitted.current = true;
    if (tree.nodes.length > 12) fit();
  }, [fit, tree.nodes.length]);
  return <div className="min-w-0 rounded-2xl border border-line bg-surface-muted p-4">
    <h4 className="font-semibold text-fg">Route tree preview</h4>
    <p className="mt-2 text-sm leading-relaxed text-muted">Each destination appears once. Arrows show allowed connections, including routes that join at the same stop. Select a stop to highlight its connections; scroll or zoom to explore.</p>
    {tree.nodes.length ? <>
      <div role="group" aria-label="Route preview zoom" className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={zoom <= .25} onClick={() => setZoom(value => Math.max(.25, value - .25))} aria-label="Zoom out route preview">−</Button>
        <span className="min-w-12 text-center text-sm tabular-nums text-fg" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <Button variant="outline" size="sm" disabled={zoom >= 1.5} onClick={() => setZoom(value => Math.min(1.5, value + .25))} aria-label="Zoom in route preview">+</Button>
        <Button variant="outline" size="sm" onClick={fit}>Fit route preview</Button>
        <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setSelectedId(null); }}>Reset preview</Button>
      </div>
      {layout.hasCycle && <p role="status" className="mt-3 text-sm text-red-600 dark:text-red-300">Remove loops before saving this route.</p>}
      <div ref={viewport} tabIndex={0} aria-label="Route tree preview" role="region" style={{ height: Math.min(560, layout.height * zoom + 16) }} className="mt-3 max-h-[65vh] max-w-full overflow-auto rounded-xl border border-line bg-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
        <div className={styles.scaled} style={{ width: layout.width * zoom, height: layout.height * zoom }}>
          <div className={styles.canvas} style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
            <svg width={layout.width} height={layout.height} aria-hidden="true" className={styles.connectors}>
              <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
              {layout.edges.map(edge => {
                const highlighted = !selected || edge.from === selected.id || edge.to === selected.id;
                return <path key={`${edge.from}-${edge.to}`} data-route-edge={`${edge.from}-${edge.to}`} d={edge.path} fill="none" stroke="currentColor" strokeWidth={!selected ? 2 : highlighted ? 3 : 1} opacity={highlighted ? .85 : .12} markerEnd={`url(#${marker})`} />;
              })}
            </svg>
            <ul className={styles.nodes}>{layout.nodes.map(({ id, node, x, y, parents }) => <li key={id} data-route-node={id} style={{ left: x, top: y, width: ROUTE_CARD.width, height: ROUTE_CARD.height }} className={styles.node}>
              <button type="button" data-ui-action="" aria-label={`Inspect connections for ${label(id)}`} aria-pressed={selectedId === id} onClick={() => setSelectedId(current => current === id ? null : id)} className={`h-full w-full rounded-2xl border p-3 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${tree.roots.includes(id) ? "border-primary-900 bg-primary-900 text-white" : "border-line bg-surface text-fg"} ${selectedId === id ? "ring-2 ring-accent-500" : ""}`}>
                <span className="line-clamp-2 block font-semibold">{label(id)}</span><span className="mt-1 block text-xs opacity-80">{suggestionsOnly ? `${node.next.length} suggested next ${node.next.length === 1 ? "stop" : "stops"}` : <>{node.nights} {node.nights === 1 ? "night" : "nights"} · +₹{node.extraPricePerPerson.toLocaleString("en-IN")}</>}</span>{parents.length > 1 && <span className="mt-1 block text-xs font-semibold">{parents.length} routes join here</span>}{node.canFinish && <span className="mt-1 block text-xs opacity-80">Can finish here</span>}
              </button>
            </li>)}</ul>
          </div>
        </div>
      </div>
      {selected && <p role="status" className="mt-3 text-sm leading-relaxed text-fg"><strong>{label(selected.id)}</strong> · Arrives from: {selected.parents.map(label).join(", ") || "Starting point"}. Next: {selected.node.next.map(label).join(", ") || "End of route"}.</p>}
    </> : <p className="mt-4 text-sm text-muted">Add a destination and mark a starting point to see your route.</p>}
  </div>;
}
