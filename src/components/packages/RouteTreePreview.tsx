import type { RouteTree } from "@/lib/package-content";
import styles from "./RouteTreePreview.module.css";

/** The full graph is an operator preview; customers see only the next choices. */
export default function RouteTreePreview({ tree, names }: { tree: RouteTree; names: Map<number, string> }) {
  const byId = new Map(tree.nodes.map(node => [node.spotId, node]));
  function branch(id: number, ancestors: number[] = []): React.ReactNode {
    const node = byId.get(id);
    if (!node || ancestors.includes(id) || ancestors.length >= 32) return <li key={id}><p className="p-3 text-sm text-red-600">Check this branch for a missing destination or loop.</p></li>;
    return <li key={id} className={styles.branch}><div className={`${styles.node} ${ancestors.length ? "border-line bg-surface text-fg" : "border-primary-900 bg-primary-900 text-white"}`}><p className="font-semibold">{names.get(id) ?? "Unavailable destination"}</p><p className="mt-1 text-xs opacity-80">{node.nights} {node.nights === 1 ? "night" : "nights"} · +₹{node.extraPricePerPerson.toLocaleString("en-IN")}</p>{node.canFinish && <p className="mt-1 text-xs opacity-80">Can finish here</p>}</div>{node.next.length > 0 && <ul className={styles.children}>{node.next.map(next => branch(next, [...ancestors, id]))}</ul>}</li>;
  }
  return <div className="rounded-2xl border border-line bg-surface-muted p-4"><h4 className="font-semibold text-fg">Route tree preview</h4><p className="mt-2 text-sm leading-relaxed text-muted">Each arrow is an allowed next stop. Customers choose one branch at a time. Scroll the preview sideways for longer routes.</p>{tree.roots.length ? <div tabIndex={0} aria-label="Route tree preview" role="region" className="mt-4 max-w-full overflow-x-auto rounded-xl p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"><ul className={styles.forest}>{tree.roots.map(id => branch(id))}</ul></div> : <p className="mt-4 text-sm text-muted">Mark a starting point to see your tree.</p>}</div>;
}
