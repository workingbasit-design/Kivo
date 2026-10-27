/**
 * Scroll lesson 1 — remembers the last record the pro opened so the
 * dashboard "Continue" card can resume it. Local only (localStorage);
 * nothing leaves the device, and a private-mode failure is ignored.
 * Mounted on job, quote, and invoice detail pages.
 */
"use client";

import { useEffect } from "react";
import { LAST_OPENED_KEY, type ContinueKind } from "@/lib/continue-candidate";

export default function RecordLastOpened({
  kind,
  id,
  title,
  subtitle,
}: {
  kind: ContinueKind;
  id: string;
  title: string;
  subtitle: string;
}) {
  useEffect(() => {
    try {
      window.localStorage.setItem(
        LAST_OPENED_KEY,
        JSON.stringify({ kind, id, title, subtitle })
      );
    } catch {
      // Storage unavailable (private mode, quota) — Continue just falls
      // back to the server candidate. Never break the page for this.
    }
  }, [kind, id, title, subtitle]);
  return null;
}
