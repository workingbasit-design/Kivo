/**
 * Motion Edition — the dashboard's visible command-palette trigger.
 *
 * The global palette (⌘K / Ctrl+K, nav + natural-language + record
 * search) already lives in the app shell; this button is its dashboard
 * entry point, matching the prototype's "Quick actions ⌘K" header
 * control. It dispatches the same `everyjob:open-palette` event the
 * sidebar trigger and the keyboard shortcut use.
 */
"use client";

import { Search } from "@/components/icons";
import { openPalette } from "@/components/PaletteTrigger";

export default function DashboardPaletteButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label={`${label} (⌘K)`}
      className="ej-palette-trigger"
    >
      <Search size={16} aria-hidden />
      <span>{label}</span>
      <kbd aria-hidden>⌘K</kbd>
    </button>
  );
}
