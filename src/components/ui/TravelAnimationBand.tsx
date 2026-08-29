/**
 * Full-width animated SVG scene — night road with a driving Tempo Traveller.
 * Pure SVG + CSS: no framer-motion needed, zero JS runtime.
 * SMIL <animateTransform> handles vehicle X-position and cloud drift (reliable in
 * SVG coordinate space regardless of how the SVG is scaled by the browser).
 * CSS handles wheel rotation (transform-box: fill-box keeps origin at wheel center).
 */

const TREE_X = [55, 195, 355, 510, 685, 840, 1005, 1155, 1320, 1430];

function Tree({ x, large }: { x: number; large: boolean }) {
  const h = large ? 46 : 34;
  const w = large ? 44 : 32;
  const mx = w / 2;
  return (
    <g transform={`translate(${x}, ${180 - h})`}>
      <polygon
        points={`${mx},0 0,${h * 0.6} ${w},${h * 0.6}`}
        fill="#052e16"
        opacity="0.95"
      />
      <polygon
        points={`${mx},${h * 0.2} 2,${h * 0.8} ${w - 2},${h * 0.8}`}
        fill="#064e3b"
        opacity="0.9"
      />
      <rect
        x={mx - 3}
        y={h * 0.78}
        width="6"
        height={h * 0.22}
        fill="#7c3f00"
        opacity="0.85"
      />
    </g>
  );
}

export default function TravelAnimationBand() {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 240, backgroundColor: "#0b1437" }}
      aria-hidden="true"
      role="presentation"
    >
      <svg
        viewBox="0 0 1440 240"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="band-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1437" />
            <stop offset="60%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>

        {/* ── Sky ─────────────────────────────────────── */}
        <rect width="1440" height="240" fill="url(#band-sky)" />

        {/* ── Stars ───────────────────────────────────── */}
        <circle cx="72"   cy="16" r="1.5" fill="#fff" opacity="0.85" className="sv-t1" />
        <circle cx="210"  cy="30" r="1"   fill="#fff" opacity="0.65" className="sv-t2" />
        <circle cx="345"  cy="11" r="2"   fill="#fff" opacity="0.9"  className="sv-t3" />
        <circle cx="490"  cy="25" r="1"   fill="#fff" opacity="0.7"  className="sv-t4" />
        <circle cx="630"  cy="8"  r="1.5" fill="#fff" opacity="0.8"  className="sv-t1" />
        <circle cx="740"  cy="36" r="1"   fill="#fff" opacity="0.5"  className="sv-t2" />
        <circle cx="870"  cy="14" r="2"   fill="#fff" opacity="0.9"  className="sv-t3" />
        <circle cx="970"  cy="28" r="1"   fill="#fff" opacity="0.6"  className="sv-t4" />
        <circle cx="1095" cy="10" r="1.5" fill="#fff" opacity="0.75" className="sv-t1" />
        <circle cx="1195" cy="22" r="1"   fill="#fff" opacity="0.8"  className="sv-t2" />
        <circle cx="1310" cy="16" r="2"   fill="#fff" opacity="0.9"  className="sv-t3" />
        <circle cx="1405" cy="34" r="1"   fill="#fff" opacity="0.6"  className="sv-t4" />

        {/* ── Moon (crescent) ─────────────────────────── */}
        <circle cx="1345" cy="38" r="30"  fill="#fef9c3" opacity="0.88" />
        <circle cx="1358" cy="30" r="26"  fill="#0b1437" />

        {/* ── Far mountains ───────────────────────────── */}
        <path
          d="M-80,140 L70,60 L180,100 L330,38 L510,88 L670,28 L850,72 L1010,18 L1175,68 L1340,12 L1440,58 L1540,22 L1540,185 L-80,185Z"
          fill="#1e40af"
          opacity="0.6"
        />

        {/* ── Near mountains ──────────────────────────── */}
        <path
          d="M-80,162 L80,96 L240,136 L410,74 L600,126 L770,58 L950,108 L1110,52 L1280,102 L1440,64 L1540,94 L1540,185 L-80,185Z"
          fill="#1e3a8a"
        />

        {/* ── Grass strip ─────────────────────────────── */}
        <rect x="0" y="180" width="1440" height="12" fill="#052e16" />

        {/* ── Road ────────────────────────────────────── */}
        <rect x="0" y="190" width="1440" height="50" fill="#1f2937" />
        {/* Road edges */}
        <rect x="0" y="190" width="1440" height="3" fill="#374151" />
        <rect x="0" y="234" width="1440" height="3" fill="#374151" />

        {/* ── Road centre dashes (SMIL scroll) ─────────── */}
        <g>
          {Array.from({ length: 20 }).map((_, i) => (
            <rect
              key={i}
              x={-100 + i * 100}
              y="210"
              width="60"
              height="4"
              rx="2"
              fill="#fbbf24"
              opacity="0.7"
            />
          ))}
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0"
            to="-100 0"
            dur="0.55s"
            repeatCount="indefinite"
          />
        </g>

        {/* ── Trees (static) ─────────────────────────── */}
        {TREE_X.map((x, i) => (
          <Tree key={x} x={x} large={i % 2 === 0} />
        ))}

        {/* ── Clouds (two sets for seamless loop) ────── */}
        <g>
          {/* Set 1 */}
          <ellipse cx="160"  cy="52"  rx="78"  ry="22" fill="white" opacity="0.1" />
          <ellipse cx="205"  cy="42"  rx="46"  ry="16" fill="white" opacity="0.08" />
          <ellipse cx="620"  cy="38"  rx="92"  ry="25" fill="white" opacity="0.1" />
          <ellipse cx="670"  cy="30"  rx="54"  ry="18" fill="white" opacity="0.07" />
          <ellipse cx="1110" cy="56"  rx="80"  ry="22" fill="white" opacity="0.09" />
          <ellipse cx="1155" cy="46"  rx="48"  ry="16" fill="white" opacity="0.07" />
          {/* Set 2 (offset 1440 for seamless) */}
          <ellipse cx="1600" cy="52"  rx="78"  ry="22" fill="white" opacity="0.1" />
          <ellipse cx="1645" cy="42"  rx="46"  ry="16" fill="white" opacity="0.08" />
          <ellipse cx="2060" cy="38"  rx="92"  ry="25" fill="white" opacity="0.1" />
          <ellipse cx="2110" cy="30"  rx="54"  ry="18" fill="white" opacity="0.07" />
          <ellipse cx="2550" cy="56"  rx="80"  ry="22" fill="white" opacity="0.09" />
          <ellipse cx="2595" cy="46"  rx="48"  ry="16" fill="white" opacity="0.07" />
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0"
            to="-1440 0"
            dur="28s"
            repeatCount="indefinite"
          />
        </g>

        {/* ── Tempo Traveller ─────────────────────────── */}
        {/*
          Group placed so wheel-bottom (local y=+14) lands on road surface (SVG y=190).
          Wheel centre is at local y=0, so group translateY = 190 - 14 = 176.
          The inner <g> with SMIL only moves X; outer group provides the fixed Y.
        */}
        <g transform="translate(0, 176)">
          <g>
            {/* ─ Roof rack ─ */}
            <rect x="4"   y="-79" width="149" height="7" rx="3" fill="#1e40af" />
            <rect x="20"  y="-79" width="3"   height="7" fill="#1d4ed8" />
            <rect x="56"  y="-79" width="3"   height="7" fill="#1d4ed8" />
            <rect x="92"  y="-79" width="3"   height="7" fill="#1d4ed8" />
            <rect x="128" y="-79" width="3"   height="7" fill="#1d4ed8" />

            {/* ─ Front cab (taller, right side) ─ */}
            <rect x="155" y="-70" width="47" height="67" rx="5" fill="#1d4ed8" />

            {/* ─ Main passenger body ─ */}
            <rect x="0"   y="-60" width="162" height="57" rx="5" fill="#1e3a8a" />

            {/* ─ Windshield ─ */}
            <rect x="161" y="-64" width="32" height="30" rx="4" fill="#93c5fd" opacity="0.92" />
            {/* Windshield reflection glint */}
            <line x1="164" y1="-61" x2="170" y2="-38" stroke="white" strokeWidth="1" opacity="0.35" />

            {/* ─ Passenger windows ─ */}
            <rect x="8"   y="-52" width="25" height="21" rx="3" fill="#93c5fd" opacity="0.86" />
            <rect x="41"  y="-52" width="25" height="21" rx="3" fill="#93c5fd" opacity="0.86" />
            <rect x="74"  y="-52" width="25" height="21" rx="3" fill="#93c5fd" opacity="0.86" />
            <rect x="107" y="-52" width="25" height="21" rx="3" fill="#93c5fd" opacity="0.86" />
            <rect x="138" y="-52" width="14" height="21" rx="3" fill="#93c5fd" opacity="0.86" />

            {/* ─ Door dividers ─ */}
            <line x1="35"  y1="-60" x2="35"  y2="-3" stroke="#1d4ed8" strokeWidth="1.5" />
            <line x1="68"  y1="-60" x2="68"  y2="-3" stroke="#1d4ed8" strokeWidth="1.5" />
            <line x1="101" y1="-60" x2="101" y2="-3" stroke="#1d4ed8" strokeWidth="1.5" />
            <line x1="133" y1="-60" x2="133" y2="-3" stroke="#1d4ed8" strokeWidth="1.5" />

            {/* ─ Accent stripe ─ */}
            <rect x="0"   y="-26" width="155" height="8" fill="#f59e0b" />
            <rect x="155" y="-26" width="47"  height="8" fill="#fbbf24" />

            {/* ─ Headlight + glow ─ */}
            <rect x="199" y="-48" width="5" height="15" rx="2.5" fill="#fef9c3" />
            <ellipse cx="207" cy="-40" rx="8" ry="6" fill="#fef3c7" opacity="0.28" />

            {/* ─ Tail light ─ */}
            <rect x="-3" y="-50" width="5" height="14" rx="2.5" fill="#fca5a5" />

            {/* ─ Bumpers ─ */}
            <rect x="197" y="-8" width="9" height="7" rx="2" fill="#2563eb" />
            <rect x="-5"  y="-8" width="9" height="7" rx="2" fill="#374151" />

            {/* ─ Exhaust puffs ─ */}
            <circle cx="-16" cy="-10" r="5" fill="#94a3b8" opacity="0.18" />
            <circle cx="-27" cy="-14" r="8" fill="#94a3b8" opacity="0.11" />
            <circle cx="-40" cy="-18" r="10" fill="#94a3b8" opacity="0.06" />

            {/* ─ Rear wheel ─ */}
            <g className="svg-wheel">
              <circle cx="28" cy="0" r="14" fill="#111827" />
              <circle cx="28" cy="0" r="9"  fill="#1f2937" />
              <circle cx="28" cy="0" r="3"  fill="#4b5563" />
              <line x1="28" y1="-14" x2="28" y2="14"  stroke="#374151" strokeWidth="2" />
              <line x1="14" y1="0"   x2="42" y2="0"   stroke="#374151" strokeWidth="2" />
              <line x1="18" y1="-10" x2="38" y2="10"  stroke="#374151" strokeWidth="1.5" />
              <line x1="38" y1="-10" x2="18" y2="10"  stroke="#374151" strokeWidth="1.5" />
            </g>

            {/* ─ Front wheel ─ */}
            <g className="svg-wheel">
              <circle cx="174" cy="0" r="14" fill="#111827" />
              <circle cx="174" cy="0" r="9"  fill="#1f2937" />
              <circle cx="174" cy="0" r="3"  fill="#4b5563" />
              <line x1="174" y1="-14" x2="174" y2="14"  stroke="#374151" strokeWidth="2" />
              <line x1="160" y1="0"   x2="188" y2="0"   stroke="#374151" strokeWidth="2" />
              <line x1="164" y1="-10" x2="184" y2="10"  stroke="#374151" strokeWidth="1.5" />
              <line x1="184" y1="-10" x2="164" y2="10"  stroke="#374151" strokeWidth="1.5" />
            </g>

            {/* SMIL: drive from off-left to off-right */}
            <animateTransform
              attributeName="transform"
              type="translate"
              from="-225 0"
              to="1680 0"
              dur="13s"
              repeatCount="indefinite"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
