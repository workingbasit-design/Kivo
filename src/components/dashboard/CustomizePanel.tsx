"use client";

/**
 * Part C (dashboard rebuild): "Customize this screen".
 *
 * Show, hide and reorder the dashboard sections. Saved per user on the
 * server via saveDashboardLayout. The header and quick actions stay fixed;
 * only the six content sections are customizable.
 */
import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown, SlidersHorizontal, Check } from "@/components/icons";
import { saveDashboardLayout } from "@/app/actions/dashboard-layout";
import {
  moveSectionPref,
  toggleSectionPref,
  type SectionPref,
} from "@/lib/dashboard-layout-client";
import { cn } from "@/lib/utils";

export default function CustomizePanel({
  initial,
  labels,
}: {
  initial: SectionPref[];
  labels: {
    customize: string;
    title: string;
    done: string;
    reset: string;
    moveUp: string;
    moveDown: string;
    show: string;
    hide: string;
    saved: string;
    saveFailed: string;
    sectionNames: Record<string, string>;
  };
}) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<SectionPref[]>(initial);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // FIX-NOW S2: keep the editor in sync with server truth whenever the
  // page revalidates (e.g. after a save). Without this, a client-side
  // navigation back to /dashboard could show the stale mount-time order
  // even though the new order persisted. Adjusted during render (not in
  // an effect) — the React-endorsed pattern for prop-driven state sync.
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setSections(initial);
  }

  const persist = (next: SectionPref[]) => {
    setSections(next);
    setError(null);
    startTransition(async () => {
      try {
        const res = await saveDashboardLayout(next);
        if (res.ok) {
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 1500);
        } else {
          setError(labels.saveFailed);
        }
      } catch {
        // The server action threw instead of returning { ok: false } —
        // surface it instead of leaving the arrows looking dead.
        setError(labels.saveFailed);
      }
    });
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = moveSectionPref(sections, i, dir);
    if (next === sections) return; // already at the end — nothing to save
    persist(next);
  };

  const toggle = (i: number) => {
    const next = toggleSectionPref(sections, i);
    if (next === sections) return;
    persist(next);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line-strong text-[15px] font-semibold text-asphalt transition-colors hover:border-line-strong dark:border-hero-ink/20 dark:text-hero-ink"
      >
        <SlidersHorizontal size={18} aria-hidden /> {labels.customize}
      </button>
    );
  }

  return (
    <section
      aria-label={labels.title}
      className="rounded-[24px] border border-line/70 bg-surface p-5 dark:border-hero-ink/10 dark:bg-coal"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-asphalt dark:text-hero-ink">{labels.title}</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-[44px] items-center px-3 text-[14px] font-semibold text-asphalt dark:text-ink-2"
        >
          {labels.done}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-signal">
          {error}
        </p>
      )}
      <ul className="mt-2 divide-y divide-line dark:divide-white/10">
        {sections.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 py-2">
            <button
              type="button"
              role="switch"
              aria-checked={s.visible}
              aria-label={`${s.visible ? labels.hide : labels.show}: ${labels.sectionNames[s.key]}`}
              onClick={() => toggle(i)}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                s.visible ? "bg-pine" : "bg-line dark:bg-surface/20"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-all",
                  s.visible ? "left-[22px]" : "left-0.5"
                )}
              />
            </button>
            <span
              className={cn(
                "flex-1 text-[15px]",
                s.visible ? "text-asphalt dark:text-hero-ink" : "text-ink-2 dark:text-ink-2"
              )}
            >
              {labels.sectionNames[s.key]}
            </span>
            <button
              type="button"
              aria-label={`${labels.moveUp}: ${labels.sectionNames[s.key]}`}
              disabled={i === 0 || pending}
              onClick={() => move(i, -1)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-ink-2 disabled:opacity-30 dark:text-ink-2"
            >
              <ArrowUp size={18} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`${labels.moveDown}: ${labels.sectionNames[s.key]}`}
              disabled={i === sections.length - 1 || pending}
              onClick={() => move(i, 1)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-ink-2 disabled:opacity-30 dark:text-ink-2"
            >
              <ArrowDown size={18} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => persist(initial)}
          className="inline-flex min-h-[44px] items-center px-2 text-[13px] font-semibold text-ink-2 underline underline-offset-2 dark:text-ink-2"
        >
          {labels.reset}
        </button>
        {savedFlash && (
          <span className="flex items-center gap-1 text-[13px] font-semibold text-pine">
            <Check size={14} aria-hidden /> {labels.saved}
          </span>
        )}
      </div>
    </section>
  );
}
