import type { RouteTree } from "./package-content";

export const ROUTE_CARD = { width: 210, height: 148, columnGap: 28, rowGap: 76, padding: 32 };
function roundedConnection(points: { x: number; y: number }[]) {
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1], point = points[i], after = points[i + 1];
    const incoming = Math.hypot(point.x - before.x, point.y - before.y), outgoing = Math.hypot(after.x - point.x, after.y - point.y);
    const radius = Math.min(10, incoming / 2, outgoing / 2);
    if (!incoming || !outgoing) continue;
    path += ` L${point.x - (point.x - before.x) * radius / incoming},${point.y - (point.y - before.y) * radius / incoming} Q${point.x},${point.y} ${point.x + (after.x - point.x) * radius / outgoing},${point.y + (after.y - point.y) * radius / outgoing}`;
  }
  return path + ` L${points[points.length - 1].x},${points[points.length - 1].y}`;
}
/** Display layout only. Invalid drafts remain drawable without recursive expansion. */
export function layoutRoutePreview(tree: RouteTree) {
  const byId = new Map(tree.nodes.map(node => [node.spotId, node]));
  const parents = new Map(Array.from(byId.keys()).map(id => [id, new Set<number>()]));
  const children = new Map(Array.from(byId).map(([id, node]) => [id, Array.from(new Set(node.next)).filter(next => byId.has(next))]));
  for (const [id, next] of Array.from(children)) for (const child of next) parents.get(child)!.add(id);
  const pending = new Map(Array.from(parents).map(([id, incoming]) => [id, incoming.size]));
  const queue = Array.from(pending).filter(([, count]) => count === 0).map(([id]) => id);
  const levels = new Map(Array.from(byId.keys()).map(id => [id, 0]));
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const next of children.get(id)!) {
      levels.set(next, Math.max(levels.get(next)!, levels.get(id)! + 1));
      pending.set(next, pending.get(next)! - 1);
      if (pending.get(next) === 0) queue.push(next);
    }
  }
  const layers = new Map<number, number[]>();
  for (const [id, level] of Array.from(levels)) layers.set(level, [...(layers.get(level) ?? []), id]);
  const { width: cardWidth, height: cardHeight, columnGap, rowGap, padding } = ROUTE_CARD;
  const width = Math.max(1, ...Array.from(layers.values()).map(layer => layer.length)) * (cardWidth + columnGap) - columnGap + padding * 2;
  const height = Math.max(1, ...Array.from(layers.keys()).map(level => level + 1)) * (cardHeight + rowGap) - rowGap + padding * 2;
  const positions = new Map<number, { x: number; y: number }>();
  for (const [level, original] of Array.from(layers).sort(([a], [b]) => a - b)) {
    const score = (id: number) => {
      const known = Array.from(parents.get(id)!).flatMap(parent => positions.has(parent) ? [positions.get(parent)!.x] : []);
      return known.length ? known.reduce((a, b) => a + b, 0) / known.length : original.indexOf(id) * (cardWidth + columnGap);
    };
    const layer = [...original].sort((a, b) => score(a) - score(b));
    const offset = (width - (layer.length * (cardWidth + columnGap) - columnGap)) / 2;
    layer.forEach((id, i) => positions.set(id, { x: offset + i * (cardWidth + columnGap), y: padding + level * (cardHeight + rowGap) }));
  }
  const connections = Array.from(children).flatMap(([from, next]) => next.map(to => ({ from, to })));
  const skipsRow = (edge: { from: number; to: number }) => positions.get(edge.to)!.y - positions.get(edge.from)!.y !== cardHeight + rowGap;
  const sideSpace = connections.filter(skipsRow).length * 10 + (connections.some(skipsRow) ? 24 : 0);
  let lane = 0;
  const edges = connections.map(edge => {
    const from = positions.get(edge.from)!, to = positions.get(edge.to)!;
    const sx = from.x + cardWidth / 2, sy = from.y + cardHeight, tx = to.x + cardWidth / 2, ty = to.y - 4;
    if (!skipsRow(edge)) return { ...edge, path: `M${sx},${sy} C${sx},${sy + 36} ${tx},${ty - 36} ${tx},${ty}`, points: undefined };
    const x = width + 8 + lane++ * 10;
    const points = [{ x: sx, y: sy }, { x: sx, y: sy + 18 }, { x, y: sy + 18 }, { x, y: ty - 16 }, { x: tx, y: ty - 16 }, { x: tx, y: ty }];
    return { ...edge, path: roundedConnection(points), points };
  });
  return {
    width: width + sideSpace, height, hasCycle: queue.length !== byId.size,
    nodes: Array.from(byId).map(([id, node]) => ({ id, node, ...positions.get(id)!, parents: Array.from(parents.get(id)!) })),
    edges,
  };
}
