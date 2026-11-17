'use client';

/**
 * WeekStrip — the 7-day strip for the Schedule screen (Part E2).
 *
 * Client component so day cells can be drop targets for desktop
 * drag-and-drop rescheduling (HTML5 DnD). Navigation stays as Links so
 * days remain deep-linkable and the back button works.
 *
 * The non-drag path (WCAG 2.5.7) is the per-row reschedule dialog in
 * ScheduleClient — drag is never the only way to move a visit.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { toast } from 'sonner';
import { updateJobSchedule } from '@/app/actions/jobs';
import { cn } from '@/lib/utils';

export interface WeekStripDay {
  /** Calendar-day key (YYYY-MM-DD) in the business timezone. */
  key: string;
  /** Localized short weekday name. */
  dayName: string;
  /** Day of month. */
  dayNum: number;
  /** Number of jobs that day (0 shows no badge — never a row of zeros). */
  count: number;
  /** True when this is "today" in the business timezone. */
  isToday: boolean;
  /** Full holiday name, or null. Shown as a marker only. */
  holidayName: string | null;
  /** Where a click goes: new-job form when empty, day agenda otherwise. */
  href: string;
}

/** Payload set on dragstart by the agenda row's drag handle. */
export interface DragJob {
  id: string;
  title: string;
  time: string;
  status: string;
}

export const DRAG_TYPE = 'application/x-everyjob-job';

export interface WeekStripStrings {
  prevWeek: string;
  nextWeek: string;
  thisWeek: string;
  showWholeWeek: string;
  today: string;
  emptyDayNew: string;
  moved: string;
  moveFailed: string;
}

interface WeekStripProps {
  days: WeekStripDay[];
  weekLabel: string;
  prevWeekHref: string;
  nextWeekHref: string;
  /** "/schedule" — jumps back to the current week. */
  thisWeekHref: string;
  /** "/schedule?week=YYYY-MM-DD" — clears the selected day, keeps the week. */
  clearDayHref: string;
  isCurrentWeek: boolean;
  activeDay: string | null;
  strings: WeekStripStrings;
}

export default function WeekStrip({
  days,
  weekLabel,
  prevWeekHref,
  nextWeekHref,
  thisWeekHref,
  clearDayHref,
  isCurrentWeek,
  activeDay,
  strings,
}: WeekStripProps) {
  const router = useRouter();
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const isEveryJobDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(DRAG_TYPE);

  const handleDrop = (dayKey: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    setDropKey(null);
    if (!isEveryJobDrag(e) || isMoving) return;
    let job: DragJob | null = null;
    try {
      job = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as DragJob;
    } catch {
      return;
    }
    if (!job?.id) return;
    setIsMoving(true);
    try {
      const res = await updateJobSchedule(job.id, dayKey, job.time ?? '', job.status);
      if (res?.error) {
        toast.error(strings.moveFailed);
      } else {
        toast.success(
          strings.moved.replace('{title}', job.title).replace('{day}', dayKey)
        );
        router.refresh();
      }
    } catch {
      toast.error(strings.moveFailed);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="ej-week">
      <div className="ej-week-head">
        <Link
          href={prevWeekHref}
          className="ej-week-nav"
          aria-label={strings.prevWeek}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
        <div className="ej-week-title">
          {isCurrentWeek ? (
            <span
              aria-disabled="true"
              className="ej-week-this"
            >
              {strings.thisWeek}
            </span>
          ) : (
            <Link href={thisWeekHref} className="ej-week-this">
              {strings.thisWeek}
            </Link>
          )}
          <b>{weekLabel}</b>
        </div>
        <Link
          href={nextWeekHref}
          className="ej-week-nav"
          aria-label={strings.nextWeek}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>

      {/* 7-day strip. Cells are Links (deep-linkable); on desktop they also
          accept dragged visits. */}
      <div className="ej-week-days" role="list" aria-label={weekLabel}>
        {days.map((d) => {
          const isActive = activeDay === d.key;
          const isDropTarget = dropKey === d.key;
          return (
            <Link
              key={d.key}
              href={d.href}
              role="listitem"
              aria-current={isActive ? 'date' : undefined}
              aria-label={`${d.dayName} ${d.dayNum}${d.isToday ? `, ${strings.today}` : ''}${d.count === 0 ? `, ${strings.emptyDayNew}` : ''}`}
              onDragOver={(e) => {
                if (!isEveryJobDrag(e)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropKey(d.key);
              }}
              onDragLeave={() => setDropKey((k) => (k === d.key ? null : k))}
              onDrop={handleDrop(d.key)}
              className={cn(
                'ej-week-day',
                isActive && 'selected',
                d.isToday && 'today',
                isDropTarget && 'drop-target'
              )}
            >
              <span className="ej-week-day-name">{d.dayName}</span>
              <b className="ej-week-day-num">{d.dayNum}</b>
              {/* Today marker: a dot, not lime. DESIGN.md gives lime exactly
                  two jobs; "today" is a status shown with a shape. */}
              {d.isToday && (
                <span aria-hidden="true" className="ej-week-day-today-dot" />
              )}
              {/* Count badge only when there are jobs — never a row of zeros. */}
              {d.count > 0 && (
                <span className="ej-week-day-count">{d.count}</span>
              )}
              {/* Holiday marker only — the full name lives in the agenda
                  header, never as a truncated chip here. */}
              {d.holidayName && (
                <span title={d.holidayName} aria-hidden="true" className="ej-week-day-holiday">
                  🎉
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {activeDay && (
        <div className="ej-week-clear">
          <Link href={clearDayHref}>{strings.showWholeWeek}</Link>
        </div>
      )}
    </div>
  );
}
