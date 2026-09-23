"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/lib/i18n";

// Lazy overlays: never cost anything on first paint. The palette renders
// nothing until ⌘K / Ctrl+K (or its trigger) opens it; the copilot widget
// hydrates its chat UI only when mounted client-side.
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), { ssr: false });
const GlobalCopilotWidget = dynamic(() => import("@/components/GlobalCopilotWidget"), {
  ssr: false,
});

export default function LazyOverlays({
  locale = "en",
  currency,
}: {
  locale?: Locale;
  currency?: string;
}) {
  return (
    <>
      <GlobalCopilotWidget currency={currency} locale={locale} />
      <CommandPalette locale={locale} />
    </>
  );
}
