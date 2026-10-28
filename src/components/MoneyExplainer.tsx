/**
 * Scroll lesson 7 — the tap-to-expand shell. The button names the
 * question ("What do these numbers mean?"); the lines themselves come
 * from the page, built by src/lib/money-explainer.ts from the record's
 * own numbers. Collapsed by default so the totals stay scannable.
 */
"use client";

import { useState } from "react";
import type { ExplainerLine } from "@/lib/money-explainer";

export default function MoneyExplainer({
  title,
  lines,
}: {
  title: string;
  lines: ExplainerLine[];
}) {
  const [open, setOpen] = useState(false);
  if (lines.length === 0) return null;
  return (
    <div className="mt-6 print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-h-[44px] text-sm font-bold text-info hover:underline"
      >
        {title} {open ? "▴" : "▾"}
      </button>
      {open && (
        <ul className="mt-2 space-y-2.5 rounded-2xl border border-line bg-surface-2/40 px-4 py-3">
          {lines.map((line) => (
            <li key={line.label} className="text-sm">
              <p className="font-bold text-ink">{line.label}</p>
              <p className="text-ink-2 mt-0.5 leading-snug">{line.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
