import type { LandmarkKind } from "@/lib/destination-explorer";

/** Small original vector illustrations; no image downloads or map-provider calls. */
export default function MapLandmark({ kind }: { kind: LandmarkKind }) {
  return <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "dome" && <><path d="M-22 14h44M-13 14V-2h26v16M-13-2Q-14-12 0-17 14-12 13-2M0-17v-5M-4 14V6a4 4 0 0 1 8 0v8M-20 14V-11h4v25M16 14V-11h4v25M-21-11h6M15-11h6M-18-11v-5M18-11v-5" /></>}
    {kind === "mountain" && <><path d="M-17 11 -5-12 11 11M1-4 8-15 20 11M-10-3 -5 0 -1-3M5-9 8-6 11-8M-19 13H21" /><circle cx="-15" cy="-12" r="3" fill="currentColor" stroke="none" /></>}
    {kind === "palace" && <><path d="M-17 13V-3h34v16M-20 13h40M-12-3v-7h6v7M6-3v-7h6v7M-5-3v-12H5v12M-7-15h14M-3 13V5a3 3 0 0 1 6 0v8M-12 1v3m0 3v3M12 1v3m0 3v3" /></>}
    {kind === "water" && <><path d="M-20 11q5-4 10 0t10 0 10 0 10 0M-20 17q5-4 10 0t10 0 10 0 10 0M4 7 7-13M7-13Q0-22-8-14M7-13Q18-22 21-12M7-13Q-2-13-6-4M7-13Q16-13 19-3" /><circle cx="-12" cy="-12" r="4" /></>}
    {kind === "temple" && <><path d="M-18 14h36M-14 10h28M-10 10V-2L0-17 10-2v12M-12-2h24M-6-9H6M-3 10V4a3 3 0 0 1 6 0v6M0-17v-5l6 2-6 2" /></>}
    {kind === "gate" && <><path d="M-15 14V-13h30v27M-19 14h38M-18-13h36M-12-17h24M-6 14V2a6 6 0 0 1 12 0v12M-10-8h20M-10-4h20" /></>}
  </g>;
}
