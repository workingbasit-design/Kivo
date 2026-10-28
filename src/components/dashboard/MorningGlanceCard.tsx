/**
 * Scroll lesson 6 — the glance card itself (client).
 *
 * Two local behaviours, no server, no push service:
 * - Dismiss: hides the card until tomorrow (localStorage, keyed by the
 *   server-provided business-today key). The card returns each morning
 *   on its own — that daily return IS the habit mechanic.
 * - Daily reminder (opt-in, on the card): when on and the browser has
 *   granted notification permission, the first dashboard open of the
 *   day fires one local browser notification with the glance summary.
 *   Permission lives in the browser; the toggle lives in localStorage.
 *   If permission was denied in the browser, the button says so and
 *   does nothing — browsers do not allow re-prompting.
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISSED_KEY = "everyjob:glance:dismissed";
const REMINDER_KEY = "everyjob:morning-reminder";
const NOTIFIED_KEY = "everyjob:morning-notified";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode etc. — the card just stays visible */
  }
}

export default function MorningGlanceCard({
  todayKey,
  title,
  lines,
  ctaHref,
  ctaLabel,
  notificationBody,
  remindOnLabel,
  remindOffLabel,
  remindBlockedLabel,
  dismissLabel,
}: {
  todayKey: string;
  title: string;
  lines: string[];
  ctaHref: string;
  ctaLabel: string;
  notificationBody: string;
  remindOnLabel: string;
  remindOffLabel: string;
  remindBlockedLabel: string;
  dismissLabel: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [blocked, setBlocked] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage can
     only be read client-side after hydration (the server-rendered card
     must match first paint), so the per-day dismiss/reminder state is
     synced in this mount effect, not during render. */
  useEffect(() => {
    setDismissed(read(DISMISSED_KEY) === todayKey);
    setReminder(read(REMINDER_KEY) === "on");
    setBlocked(
      typeof Notification !== "undefined" &&
        Notification.permission === "denied",
    );
  }, [todayKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!reminder || dismissed) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (read(NOTIFIED_KEY) === todayKey) return;
    try {
      new Notification(title, { body: notificationBody });
      write(NOTIFIED_KEY, todayKey);
    } catch {
      /* notifications unavailable — the card itself still shows */
    }
  }, [reminder, dismissed, todayKey, title, notificationBody]);

  if (dismissed) return null;

  const dismiss = () => {
    write(DISMISSED_KEY, todayKey);
    setDismissed(true);
  };

  const toggleReminder = async () => {
    if (reminder) {
      write(REMINDER_KEY, "off");
      setReminder(false);
      return;
    }
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "denied") {
      setBlocked(true);
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        write(REMINDER_KEY, "on");
        setReminder(true);
      } else {
        setBlocked(true);
      }
    } catch {
      /* leave the toggle off */
    }
  };

  return (
    <section
      aria-label={title}
      className="rounded-[24px] border border-line/70 bg-surface p-5 dark:border-hero-ink/10 dark:bg-coal"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink-2 dark:text-ink-2">
          {title}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={dismissLabel}
          className="shrink-0 text-[13px] font-semibold text-ink-2 underline-offset-2 hover:underline dark:text-ink-2"
        >
          {dismissLabel}
        </button>
      </div>
      {lines.map((line) => (
        <p
          key={line}
          className="mt-1 text-[15px] font-bold leading-snug text-asphalt dark:text-hero-ink"
        >
          {line}
        </p>
      ))}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={ctaHref}
          className="rounded-full bg-hivis px-4 py-2 text-[13px] font-bold text-ink"
        >
          {ctaLabel}
        </Link>
        <button
          type="button"
          onClick={toggleReminder}
          disabled={blocked}
          className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink-2 disabled:opacity-50 dark:border-hero-ink/20 dark:text-ink-2"
        >
          {blocked ? remindBlockedLabel : reminder ? remindOffLabel : remindOnLabel}
        </button>
      </div>
    </section>
  );
}
