/**
 * Scroll lesson 1 — the "Continue" card (client half).
 *
 * Shows the server candidate immediately (no flash, no layout shift),
 * resolved against the last record the pro opened (localStorage,
 * written by RecordLastOpened): today's work (priorities 1–3) always
 * wins; a last-opened record wins over upcoming/admin work. Renders
 * nothing when there is nothing to resume.
 *
 * The last-opened value is read through useSyncExternalStore so the
 * card stays correct across tabs and never sets state inside an effect.
 */
"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronRight } from "@/components/icons";
import {
  LAST_OPENED_KEY,
  resolveContinueDisplay,
  type ContinueDisplay,
  type LastOpenedRecord,
} from "@/lib/continue-candidate";

export interface ContinueCardLabels {
  title: string;
  lastOpened: string;
  viewJob: string;
  viewQuote: string;
  viewInvoice: string;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(LAST_OPENED_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): null {
  return null;
}

function parseLastOpened(raw: string | null): LastOpenedRecord | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.id !== "string" || typeof rec.title !== "string") return null;
    if (rec.kind !== "job" && rec.kind !== "quote" && rec.kind !== "invoice") return null;
    return {
      kind: rec.kind,
      id: rec.id,
      title: rec.title,
      subtitle: typeof rec.subtitle === "string" ? rec.subtitle : "",
    };
  } catch {
    return null;
  }
}

export default function ContinueCard({
  serverDisplay,
  serverPriority,
  liveIds,
  labels,
}: {
  serverDisplay: ContinueDisplay | null;
  serverPriority: 1 | 2 | 3 | 4 | 5 | 6 | null;
  /** `${kind}:${id}` keys for records that still exist (server-validated). */
  liveIds: string[];
  labels: ContinueCardLabels;
}) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const lastOpened = useMemo(() => parseLastOpened(raw), [raw]);
  const live = useMemo(() => new Set(liveIds), [liveIds]);
  const display = resolveContinueDisplay(serverDisplay, serverPriority, lastOpened, labels, live);
  if (!display) return null;

  return (
    <section
      aria-label={labels.title}
      className="ej-continue-card"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="ej-card-eyebrow">
            {labels.title}
          </p>
          <h3 className="truncate">
            {display.title}
          </h3>
          <p className="ej-continue-card-meta truncate">
            {display.subtitle}
            {display.meta ? ` · ${display.meta}` : ""}
          </p>
        </div>
        <Link
          href={display.href}
          className="ej-lime-pill shrink-0"
        >
          {display.actionLabel} <ChevronRight size={16} />
        </Link>
      </div>
    </section>
  );
}
