'use client';

import { motion, AnimatePresence } from 'motion/react';
import type { LucideIcon } from '@/components/icons';

/**
 * MorphIcon - one icon fluidly morphs into another on state change.
 * Cross-fade + scale + slight rotation with spring physics (~0.22s feel).
 * For toggles: save/bookmark, expand/collapse, play/pause, etc.
 */
export default function MorphIcon({
  icon: Icon,
  activeIcon: ActiveIcon,
  active,
  size = 20,
  className = '',
}: {
  icon: LucideIcon;
  activeIcon: LucideIcon;
  active: boolean;
  size?: number;
  className?: string;
}) {
  const Current = active ? ActiveIcon : Icon;

  return (
    <span className={`inline-flex ${className}`} style={{ width: size, height: size }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={active ? 'active' : 'inactive'}
          initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.6, opacity: 0, rotate: 15 }}
          transition={{ type: 'spring', stiffness: 600, damping: 28 }}
          className="inline-flex"
        >
          <Current size={size} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
