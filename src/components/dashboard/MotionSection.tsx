/**
 * Motion Edition — staggered fade-and-rise entrance for dashboard
 * sections. With prefers-reduced-motion the children render with no
 * animation at all (motion's useReducedMotion reads the same media
 * query the kit CSS uses).
 */
"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export default function MotionSection({
  index = 0,
  children,
}: {
  /** 0-based position in the page flow; the delay caps at 0.3s. */
  index?: number;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.06, 0.3),
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
}
