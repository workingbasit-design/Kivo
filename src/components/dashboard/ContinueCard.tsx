/**
 * Scroll lesson 1 — the "Continue" card (client half).
 *
 * Shows the server candidate immediately (no flash, no layout shift),
 * resolved against the last record the pro opened (localStorage,
 * written by RecordLastOpened): today's work (priorities 1–3) always
 * wins; a last-opened record wins over upcoming/admin work. Renders
 * nothing when there is nothing to resume.
 *
 * Motion Edition: the card expands (Details toggle) to show the
 * Location / Customer / Status rows from the candidate's own fields —
 * no extra fetch, no sample data.
 *
 * The last-opened value is read through useSyncExternalStore so the
 * card stays correct across tabs and never sets state inside an effect.
 */
"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Clock3, MapPin, UserRound } from "@/components/icons";
import {
  LAST_OPENED_KEY,
  resolveContinueDisplay,
  type ContinueDisplay,
  type LastOpenedRecord,
} from "@/lib/continue-candidate";

export interface ContinueCardLabels {
  title: string;
  details: string;
  location: string;
  customer: string;
  status: string;
  noArea: string;
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
  const [expanded, setExpanded] = useState(false);
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="ej-continue-details-btn"
          >
            {labels.details}
            <ChevronDown size={14} aria-hidden className={expanded ? "ej-rotate" : ""} />
          </button>
          <Link
            href={display.href}
            className="ej-lime-pill shrink-0"
          >
            {display.actionLabel} <ChevronRight size={16} />
          </Link>
        </div>
      </div>
      <div className={`ej-continue-expand${expanded ? " ej-continue-expand--open" : ""}`}>
        <div>
          <div className="ej-continue-details">
            {display.kind === "job" ? (
              <div>
                <MapPin size={14} aria-hidden />
                <span>
                  <b>{labels.location}</b>
                  {display.area ?? labels.noArea}
                </span>
              </div>
            ) : null}
            {display.customerName ? (
              <div>
                <UserRound size={14} aria-hidden />
                <span>
                  <b>{labels.customer}</b>
                  {display.customerName}
                </span>
              </div>
            ) : null}
            {display.meta ? (
              <div>
                <Clock3 size={14} aria-hidden />
                <span>
                  <b>{labels.status}</b>
                  {display.meta}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
