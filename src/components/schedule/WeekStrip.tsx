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
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
    <div>
      <div className="flex items-center justify-between gap-2 mb-4">
        <Link
          href={prevWeekHref}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-ej-ink bg-ej-bg border border-ej-border"
          aria-label={strings.prevWeek}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
        <div className="flex items-center gap-2 flex-wrap justify-center min-w-0">
          {isCurrentWeek ? (
            <span
              aria-disabled="true"
              className="text-xs font-bold text-ej-disabled px-4 py-2 min-h-[44px] inline-flex items-center rounded-full bg-ej-surface cursor-not-allowed"
            >
              {strings.thisWeek}
            </span>
          ) : (
            <Link
              href={thisWeekHref}
              className="text-xs font-bold text-ej-ink px-4 py-2 min-h-[44px] inline-flex items-center rounded-full bg-ej-bg border border-ej-border"
            >
              {strings.thisWeek}
            </Link>
          )}
          <span className="text-sm font-bold text-ej-ink">{weekLabel}</span>
        </div>
        <Link
          href={nextWeekHref}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-ej-ink bg-ej-bg border border-ej-border"
          aria-label={strings.nextWeek}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>

      {/* 7-day strip. Cells are Links (deep-linkable); on desktop they also
          accept dragged visits. */}
      <div className="grid grid-cols-7 gap-1.5 md:gap-2" role="list" aria-label={weekLabel}>
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
                'flex flex-col items-center rounded-xl border-2 py-2 md:py-3 min-h-[64px]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ej-focus',
                isActive
                  ? 'bg-ej-primary text-ej-on-primary border-ej-primary'
                  : 'bg-ej-bg border-ej-border',
                isDropTarget && 'border-ej-info bg-ej-info-bg'
              )}
            >
              <span
                className={cn(
                  'text-[10px] font-bold',
                  isActive ? 'text-ej-on-primary/80' : d.isToday ? 'text-ej-ink' : 'text-ej-muted'
                )}
              >
                {d.dayName}
              </span>
              <span
                className={cn(
                  'text-sm md:text-base font-bold mt-0.5 tabular-nums',
                  isActive ? 'text-ej-on-primary' : 'text-ej-ink'
                )}
              >
                {d.dayNum}
              </span>
              {/* Today marker: a dot, not lime. DESIGN.md gives lime exactly
                  two jobs; "today" is a status shown with a shape. */}
              {d.isToday && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1 h-1.5 w-1.5 rounded-full',
                    isActive ? 'bg-ej-on-primary' : 'bg-ej-ink'
                  )}
                />
              )}
              {/* Count badge only when there are jobs — never a row of zeros. */}
              {d.count > 0 && (
                <span
                  className={cn(
                    'mt-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums',
                    isActive ? 'bg-ej-on-primary/25 text-ej-on-primary' : 'bg-ej-ink/10 text-ej-ink'
                  )}
                >
                  {d.count}
                </span>
              )}
              {/* Holiday marker only — the full name lives in the agenda
                  header, never as a truncated chip here. */}
              {d.holidayName && (
                <span title={d.holidayName} aria-hidden="true" className="mt-1 text-[10px] leading-none">
                  🎉
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {activeDay && (
        <div className="mt-3 text-center">
          <Link
            href={clearDayHref}
            className="text-xs font-semibold text-ej-ink inline-flex items-center min-h-[44px] px-3"
          >
            {strings.showWholeWeek}
          </Link>
        </div>
      )}
    </div>
  );
}
