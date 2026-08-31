"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Atmospheric hero backdrop: layered CSS light blooms + a cheap canvas of
 * slow-drifting motes. Pauses when scrolled off-screen; static under
 * prefers-reduced-motion.
 */
export default function HeroBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Mote = { x: number; y: number; r: number; vx: number; vy: number; a: number };
    let motes: Mote[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(90, (w * h) / 24000));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.6 + 0.4,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -(Math.random() * 0.18 + 0.04),
        a: Math.random() * 0.5 + 0.15,
      }));
    };

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy;
        if (m.y < -10) {
          m.y = h + 10;
          m.x = Math.random() * w;
        }
        if (m.x < -10) m.x = w + 10;
        if (m.x > w + 10) m.x = -10;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(191, 219, 254, ${m.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    tick();
    window.addEventListener("resize", resize);

    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running && !raf) tick();
        else if (!running) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      io.disconnect();
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#050914]">
      {/* deep base + vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#0d1b3a_0%,#060b18_45%,#04070f_100%)]" />
      {/* aurora sweep — soft, slow, well behind the content (CSS-only) */}
      <div className="hero-aurora" />
      {/* colour blooms */}
      <div
        data-hero-layer="1"
        className="absolute -left-[15%] top-[-10%] h-[65vh] w-[65vh] rounded-full bg-primary-600/25 blur-[64px] md:blur-[120px]"
      />
      <div
        data-hero-layer="2"
        className="absolute right-[-10%] top-[20%] h-[55vh] w-[55vh] rounded-full bg-accent-500/15 blur-[64px] md:blur-[130px]"
      />
      <div
        data-hero-layer="3"
        className="absolute bottom-[-20%] left-[30%] h-[50vh] w-[70vh] rounded-full bg-primary-500/15 blur-[64px] md:blur-[140px]"
      />
      {/* fine grid */}
      <div
        className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#93c5fd_1px,transparent_1px),linear-gradient(90deg,#93c5fd_1px,transparent_1px)] [background-size:64px_64px]"
        data-hero-layer="grid"
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* bottom fade into the page */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-canvas" />
    </div>
  );
}
