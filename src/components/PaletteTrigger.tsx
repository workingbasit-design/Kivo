"use client";

import React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Button that opens the global command palette (⌘K / Ctrl+K). */
export function openPalette() {
  window.dispatchEvent(new Event("everyjob:open-palette"));
}

export default function PaletteTrigger({
  locale = "en",
  variant = "sidebar",
}: {
  locale?: "en" | "fr";
  variant?: "sidebar" | "icon";
}) {
  const label = locale === "fr" ? "Recherche rapide" : "Quick search";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={openPalette}
        aria-label={`${label} (⌘K)`}
        className="p-2.5 rounded-xl hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
      >
        <Search size={20} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openPalette}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 mb-2",
        "bg-white/5 hover:bg-white/10 border border-white/10",
        "text-white/60 hover:text-white transition-colors text-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
      )}
    >
      <Search size={16} className="shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">
        ⌘K
      </kbd>
    </button>
  );
}
