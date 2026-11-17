/**
 * Motion Edition — the weekly pulse (client half).
 *
 * Seven selectable day buttons (Mon…Sun, business timezone) with a dot
 * for activity days and a ring for today — the forgiving model from
 * Scroll lesson 5, unchanged: no streaks, no red, future days dimmed.
 * Selecting a day shows that day's own totals in the footer (jobs done,
 * invoices issued, money collected — real data, passed in by the server
 * section); the footer link opens that day in the schedule.
 */
"use client";

import { useState } from "react";
import Link from "next/link";

export interface WeekPulseDay {
  key: string;
  /** Narrow weekday letter (M/T/W…). */
  letter: string;
  /** Day-of-month number. */
  dayNum: string;
  /** Full date for screen readers. */
  fullDate: string;
  active: boolean;
  future: boolean;
  isToday: boolean;
  /** Pre-formatted per-day lines, e.g. ["2 jobs done", "$120.00 collected"]. */
  lines: string[];
}

export default function WeekPulseCard({
  heading,
  summary,
  weekLabel,
  days,
  todayKey,
  noActivity,
  viewDay,
}: {
  heading: string;
  summary: string;
  weekLabel: string;
  days: WeekPulseDay[];
  todayKey: string;
  noActivity: string;
  viewDay: string;
}) {
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const selected = days.find((d) => d.key === selectedKey) ?? days[0];
  const footerText = selected
    ? selected.lines.length > 0
      ? selected.lines.join(" · ")
      : noActivity
    : noActivity;

  return (
    <section aria-label={heading} className="ej-week-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2>{heading}</h2>
          <p className="ej-week-summary">{summary}</p>
        </div>
        <span className="ej-week-pill shrink-0">{weekLabel}</span>
      </div>
      <div className="ej-week-days" role="group" aria-label={heading}>
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            aria-pressed={selectedKey === day.key}
            aria-label={day.fullDate}
            onClick={() => setSelectedKey(day.key)}
            className={[
              "ej-week-day",
              day.active ? "ej-week-day--active" : "",
              day.future ? "ej-week-day--future" : "",
              day.isToday ? "ej-week-day--today" : "",
              selectedKey === day.key ? "ej-week-day--selected" : "",
            ].join(" ")}
          >
            <span className="ej-week-day-label" aria-hidden="true">
              {day.letter}
            </span>
            <span className="ej-week-day-num" aria-hidden="true">
              {day.dayNum}
            </span>
            <span className="ej-week-day-dot" aria-hidden="true" />
          </button>
        ))}
      </div>
      {selected ? (
        <div className="ej-week-pulse-footer">
          <span className="min-w-0">
            <span className="font-semibold">{selected.fullDate}</span>
            {" · "}
            {footerText}
          </span>
          <Link href={`/schedule?day=${selected.key}`} className="shrink-0 font-semibold text-ink underline underline-offset-2">
            {viewDay}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
