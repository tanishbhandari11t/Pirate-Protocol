"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Fog } from "./Fog";
import { Galleon } from "./Galleon";
import { NightSky } from "./NightSky";
import { Ocean } from "./Ocean";
import { Particles } from "./Particles";

/**
 * Persistent world behind every screen. Lives in the root layout so the sea keeps
 * moving across navigations; inner screens only dim and blur it.
 */
export function SceneBackground() {
  const pathname = usePathname();
  const isHarbour = pathname === "/";

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-abyss" aria-hidden>
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ scale: isHarbour ? 1 : 1.08, y: isHarbour ? 0 : 30 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <NightSky />
        <Galleon className="absolute bottom-[34%] left-[8%] h-40 w-48 opacity-90 md:h-56 md:w-64" />
        <Ocean className="top-[62%]" />
        <Fog />
      </motion.div>

      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(3,7,12,0.3)_0%,rgba(3,7,12,0.72)_100%)]"
        initial={false}
        animate={{ opacity: isHarbour ? 0 : 1 }}
        transition={{ duration: 1.2 }}
      />

      <Particles />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.75)_100%)]" />
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay [background-image:var(--noise)]" />
    </div>
  );
}
