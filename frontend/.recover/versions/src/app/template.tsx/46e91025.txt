"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Re-mounts on every navigation: each screen surfaces out of a fog veil.
 * Only opacity/translate are animated on the content so `position: fixed` children stay viewport-anchored.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <>
      <motion.div
        className="relative min-h-dvh"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40 bg-[radial-gradient(ellipse_at_center,rgba(156,196,204,0.18),rgba(3,7,12,0.95)_70%)]"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
    </>
  );
}
