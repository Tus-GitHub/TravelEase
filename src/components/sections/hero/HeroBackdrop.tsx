/** Static atmosphere: visible in the first HTML, with no canvas or animation loop. */
export default function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-[#050914]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,#18345a_0%,transparent_55%),radial-gradient(ellipse_at_100%_45%,#332b22_0%,transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(#93c5fd_1px,transparent_1px),linear-gradient(90deg,#93c5fd_1px,transparent_1px)] [background-size:64px_64px]" />
      <svg viewBox="0 0 1440 600" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-2/3 w-full" fill="none">
        <path d="M0 460 220 230 380 370 690 70 980 350 1170 180 1440 430V600H0Z" fill="#13263b" fillOpacity=".5" />
        <path d="m570 186 120-116 120 116-82-36-38 22-44-26Z" fill="#93c5fd" fillOpacity=".08" />
        <path d="M0 540 320 380 580 490 900 300 1200 470 1440 330V600H0Z" fill="#0b1828" />
        <path d="M740 600c-170-100 390-100 150-255" stroke="#fbbf24" strokeOpacity=".16" strokeWidth="2" strokeDasharray="6 12" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-canvas" />
    </div>
  );
}
