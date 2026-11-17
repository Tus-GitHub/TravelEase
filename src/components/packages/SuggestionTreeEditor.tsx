"use client";
import { useMemo, useRef, useState } from "react";
import Button from "@/components/common/Button";
import ActionDialog from "@/components/common/ActionDialog";
import Icon from "@/components/common/Icon";
import RouteTreePreview from "./RouteTreePreview";
import { expandedSuggestionTree, type SuggestedTree } from "@/lib/route-templates";

interface Place {
  id: number;
  name: string;
  cityName?: string;
  regionId?: number;
  isActive?: boolean;
  imageUrl?: string | null;
}

export default function SuggestionTreeEditor({
  value,
  onChange,
  spots,
}: {
  value: SuggestedTree;
  onChange: (tree: SuggestedTree) => void;
  spots: Place[];
}) {
  const [selected, setSelected] = useState<number | null>(value.roots[0] ?? null);
  const [remove, setRemove] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [addingRoot, setAddingRoot] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [query, setQuery] = useState("");
  const history = useRef<SuggestedTree[]>([]);

  const names = useMemo(() => new Map(spots.map((spot) => [spot.id, spot.name])), [spots]);
  const images = useMemo(
    () => new Map(spots.filter((s) => s.imageUrl).map((spot) => [spot.id, spot.imageUrl as string])),
    [spots],
  );
  const spotMap = useMemo(() => new Map(spots.map((spot) => [spot.id, spot])), [spots]);
  const current = !addingRoot ? (value.nodes.find((node) => node.spotId === selected) ?? value.nodes[0]) : undefined;

  function update(tree: SuggestedTree) {
    history.current = [...history.current.slice(-19), structuredClone(value)];
    onChange(tree);
  }

  function add(id: number, parent?: number) {
    const node = value.nodes.find((n) => n.spotId === id);
    let nodes = node ? value.nodes : [...value.nodes, { spotId: id, next: [], canFinish: true }];
    if (parent) {
      nodes = nodes.map((n) => (n.spotId === parent ? { ...n, next: [...n.next, id] } : n));
    }
    update({ roots: parent ? value.roots : [...value.roots, id], nodes });
    setAddingRoot(false);
    setQuery("");
    if (!parent || autoAdvance) {
      setSelected(id);
    }
  }

  function removeLink(parentId: number, childId: number) {
    update({
      ...value,
      nodes: value.nodes.map((node) =>
        node.spotId === parentId ? { ...node, next: node.next.filter((next) => next !== childId) } : node,
      ),
    });
  }

  const loops = (target: number, from: number): boolean => {
    const visited = new Set<number>();
    const queue = [target];
    while (queue.length) {
      const id = queue.pop()!;
      if (id === from) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(...(value.nodes.find((n) => n.spotId === id)?.next ?? []));
    }
    return false;
  };

  const rootChoices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spots
      .filter((spot) => spot.isActive !== false && !value.nodes.some((n) => n.spotId === spot.id))
      .filter((spot) => !q || spot.name.toLowerCase().includes(q) || (spot.cityName ?? "").toLowerCase().includes(q));
  }, [spots, value.nodes, query]);

  const nextChoices = useMemo(() => {
    if (!current) return [];
    const q = query.trim().toLowerCase();
    return spots
      .filter(
        (spot) =>
          spot.isActive !== false &&
          spot.id !== current.spotId &&
          !value.roots.includes(spot.id) &&
          !current.next.includes(spot.id) &&
          !loops(spot.id, current.spotId) &&
          (value.nodes.length < 32 || value.nodes.some((n) => n.spotId === spot.id)),
      )
      .filter((spot) => !q || spot.name.toLowerCase().includes(q) || (spot.cityName ?? "").toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, current, value, query]);

  const parentsOfCurrent = useMemo(() => {
    if (!current) return [];
    return value.nodes.filter((n) => n.next.includes(current.spotId)).map((n) => n.spotId);
  }, [value.nodes, current]);

  const showRootPicker = addingRoot || !current;

  return (
    <section className="min-w-0 space-y-5">
      {/* Header + mode controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-fg">Visual Route Builder</h2>
          <p className="mt-1 text-sm text-muted">
            Click any destination chip to build your route step-by-step — no dropdown hunting needed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={mode === "edit" ? "accent" : "outline"} size="sm" onClick={() => setMode("edit")}>
            Visual Builder
          </Button>
          <Button variant={mode === "preview" ? "accent" : "outline"} size="sm" onClick={() => setMode("preview")}>
            Preview Tree
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!history.current.length}
            onClick={() => {
              const previous = history.current.pop();
              if (previous) onChange(previous);
            }}
          >
            Undo
          </Button>
        </div>
      </div>

      {/* Quick Start Points Bar */}
      {value.roots.length > 0 && mode === "edit" && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface-muted p-3">
          <span className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Starts:</span>
          {value.roots.map((rootId) => (
            <button
              key={rootId}
              type="button"
              onClick={() => {
                setAddingRoot(false);
                setSelected(rootId);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                !addingRoot && current?.spotId === rootId
                  ? "border-amber-400 bg-amber-400/20 text-amber-500 dark:text-amber-300"
                  : "border-line bg-surface text-fg hover:border-amber-400/50"
              }`}
            >
              <Icon name="map-pin" className="h-3.5 w-3.5 text-amber-400" />
              {names.get(rootId) ?? "Stop"}
            </button>
          ))}
          {value.roots.length < 8 && value.nodes.length < 32 && (
            <button
              type="button"
              onClick={() => {
                setAddingRoot(true);
                setQuery("");
              }}
              className={`inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold transition-colors ${
                addingRoot
                  ? "border-amber-400 bg-amber-400/15 text-amber-400"
                  : "border-line text-muted hover:border-amber-400/60 hover:text-fg"
              }`}
            >
              + Add start point
            </button>
          )}
        </div>
      )}

      {mode === "preview" ? (
        <RouteTreePreview suggestionsOnly tree={expandedSuggestionTree(value)} names={names} images={images} />
      ) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Left Rail: All Stops in Route */}
          <div className="min-w-0 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                All Stops ({value.nodes.length}/32)
              </p>
              {value.nodes.length > 0 && value.roots.length < 8 && (
                <button
                  type="button"
                  onClick={() => {
                    setAddingRoot(true);
                    setQuery("");
                  }}
                  className="text-xs font-semibold text-amber-500 hover:underline dark:text-amber-300"
                >
                  + New start
                </button>
              )}
            </div>
            <div
              role="group"
              aria-label="Route destinations"
              className="max-h-[420px] space-y-2 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface-muted/60 p-2.5"
            >
              {value.nodes.map((node) => {
                const isSelected = !addingRoot && current?.spotId === node.spotId;
                const isRoot = value.roots.includes(node.spotId);
                return (
                  <button
                    type="button"
                    key={node.spotId}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setAddingRoot(false);
                      setSelected(node.spotId);
                    }}
                    className={`w-full rounded-xl border p-3 text-left text-sm transition-all ${
                      isSelected
                        ? "border-amber-400 bg-amber-400/15 shadow-sm"
                        : "border-line bg-surface hover:border-amber-400/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-fg">
                        {names.get(node.spotId) ?? "Unavailable"}
                      </span>
                      {isRoot && (
                        <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-500 dark:text-amber-300">
                          Start
                        </span>
                      )}
                    </div>
                    <span className="mt-1 block text-xs text-muted">
                      {node.next.length === 0 ? "End / finish stop" : `${node.next.length} next stop${node.next.length === 1 ? "" : "s"} →`}
                    </span>
                  </button>
                );
              })}
              {!value.nodes.length && (
                <p className="p-3 text-xs leading-relaxed text-muted">
                  Pick your first starting destination from the panel on the right.
                </p>
              )}
            </div>
          </div>

          {/* Right Workspace: Easy Click-to-Add Builder */}
          <div className="min-w-0 space-y-5 rounded-3xl border border-line bg-surface p-5">
            {showRootPicker ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-300">
                      Step 1 · Starting Point
                    </p>
                    <h3 className="mt-1 font-display text-xl font-bold text-fg">
                      Click a destination to start from
                    </h3>
                  </div>
                  {current === undefined && value.nodes.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setAddingRoot(false)}>
                      Cancel
                    </Button>
                  )}
                </div>

                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter cities or places (e.g. Delhi, Manali, Jaipur)…"
                  className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm text-fg outline-none focus:border-amber-400"
                />

                {!spots.length ? (
                  <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                    Select a Region above first to see its destinations.
                  </p>
                ) : !rootChoices.length ? (
                  <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                    No matching unused destinations found.
                  </p>
                ) : (
                  <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                    {rootChoices.map((spot) => (
                      <button
                        key={spot.id}
                        type="button"
                        disabled={value.roots.length >= 8 || value.nodes.length >= 32}
                        onClick={() => add(spot.id)}
                        className="group flex items-center gap-2.5 rounded-xl border border-line bg-surface-muted/70 px-3 py-2 text-left transition-all hover:border-amber-400 hover:bg-amber-400/10 disabled:opacity-40"
                      >
                        {spot.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={spot.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-fg">{spot.name}</span>
                          {spot.cityName && spot.cityName !== spot.name && (
                            <span className="block truncate text-xs text-muted">{spot.cityName}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-amber-500 opacity-75 group-hover:opacity-100 dark:text-amber-300">
                          + Start
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Current Stop Header + Incoming Parents */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    {parentsOfCurrent.length > 0 && (
                      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span>From:</span>
                        {parentsOfCurrent.map((pid) => (
                          <button
                            key={pid}
                            type="button"
                            onClick={() => setSelected(pid)}
                            className="rounded-full border border-line bg-surface-muted px-2.5 py-0.5 font-medium text-fg hover:border-amber-400"
                          >
                            ← {names.get(pid)}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-display text-2xl font-bold text-fg">
                        {names.get(current.spotId) ?? "Unavailable destination"}
                      </h3>
                      {spotMap.get(current.spotId)?.cityName &&
                        spotMap.get(current.spotId)?.cityName !== names.get(current.spotId) && (
                          <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-muted">
                            {spotMap.get(current.spotId)?.cityName}
                          </span>
                        )}
                    </div>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => setRemove(true)}>
                    Remove stop
                  </Button>
                </div>

                {/* Connected Next Stops */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Connected next stops ({current.next.length}/8)
                  </p>
                  {current.next.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {current.next.map((id) => (
                        <div
                          key={id}
                          className="inline-flex items-center overflow-hidden rounded-full border border-amber-400/35 bg-amber-400/10"
                        >
                          <button
                            type="button"
                            onClick={() => setSelected(id)}
                            className="px-3.5 py-1.5 text-sm font-semibold text-fg transition-colors hover:bg-amber-400/20"
                            title={`Jump to ${names.get(id)} to add onward stops`}
                          >
                            → {names.get(id)}
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove connection to ${names.get(id)}`}
                            onClick={() => removeLink(current.spotId, id)}
                            className="border-l border-amber-400/25 px-2.5 py-1.5 text-xs font-bold text-muted hover:bg-red-500/20 hover:text-red-400"
                            title="Unlink this stop"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      No onward stops yet — click any destination below to connect it after{" "}
                      <strong className="text-fg">{names.get(current.spotId)}</strong>.
                    </p>
                  )}
                </div>

                {/* One-Click Next Destination Grid */}
                <div className="space-y-3 border-t border-line pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-fg">
                      Add next stop after {names.get(current.spotId)}
                    </p>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={autoAdvance}
                        onChange={(e) => setAutoAdvance(e.target.checked)}
                      />
                      Auto-step into added stop
                    </label>
                  </div>

                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search next city or spot…"
                    className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm text-fg outline-none focus:border-amber-400"
                  />

                  {current.next.length >= 8 ? (
                    <p className="text-xs text-amber-500">Maximum 8 next stops reached for this stop.</p>
                  ) : !nextChoices.length ? (
                    <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">
                      No matching destinations available to connect here.
                    </p>
                  ) : (
                    <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                      {nextChoices.map((spot) => {
                        const inTree = value.nodes.some((n) => n.spotId === spot.id);
                        return (
                          <button
                            key={spot.id}
                            type="button"
                            onClick={() => add(spot.id, current.spotId)}
                            className="group flex items-center gap-2.5 rounded-xl border border-line bg-surface-muted/60 px-3 py-2 text-left transition-all hover:border-amber-400 hover:bg-amber-400/10"
                          >
                            {spot.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={spot.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-fg">{spot.name}</span>
                              <span className="block truncate text-[11px] text-muted">
                                {spot.cityName && spot.cityName !== spot.name ? spot.cityName : ""}
                                {inTree ? (spot.cityName && spot.cityName !== spot.name ? " · join branch" : "Join branch") : ""}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-bold text-amber-500 opacity-75 group-hover:opacity-100 dark:text-amber-300">
                              + Add
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {remove && current && (
        <ActionDialog
          title={`Remove ${names.get(current.spotId)}?`}
          description="This removes only this stop and its connections. Other destinations remain; reconnect any detached stops before publishing. Undo is available."
          confirmLabel="Remove stop"
          danger
          onClose={() => setRemove(false)}
          onConfirm={async () => {
            update({
              roots: value.roots.filter((id) => id !== current.spotId),
              nodes: value.nodes
                .filter((n) => n.spotId !== current.spotId)
                .map((n) => ({ ...n, next: n.next.filter((id) => id !== current.spotId) })),
            });
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}
