"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Contextual route-enter transition for the marketing pages — a quick clip +
 * lift rather than a generic crossfade. Re-mounts on every navigation.
 * (Full shared-element morphs, e.g. a vehicle image expanding into its detail
 * page, are a deeper follow-up.)
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, clipPath: "inset(0 0 6% 0)" }}
      animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
      transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
