"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";

interface AnimateInViewProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** How far (px) to slide up from. Default 28. */
  y?: number;
}

/**
 * Fades + slides children into view once they enter the viewport.
 * Use `delay` to stagger cards in a grid.
 */
export default function AnimateInView({
  children,
  delay = 0,
  className,
  y = 28,
}: AnimateInViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
