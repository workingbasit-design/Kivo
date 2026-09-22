/** Minutes between clock-in and clock-out (or now for an active session). */
export function entryMinutes(
  clockIn: Date | string,
  clockOut: Date | string | null,
  now: number = Date.now()
): number {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : now;
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 60000);
}

/** 150 -> "2h 30m", 45 -> "45m", 0 -> "0m" */
export function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Start of day N days ago (local time). */
export function startOfDayDaysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

/** 'YYYY-MM-DD' -> start-of-day Date, or null if invalid. */
export function parseDateStart(dateStr: string | undefined): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** 'YYYY-MM-DD' -> end-of-day Date, or null if invalid. */
export function parseDateEnd(dateStr: string | undefined): Date | null {
  const start = parseDateStart(dateStr);
  if (!start) return null;
  start.setHours(23, 59, 59, 999);
  return start;
}

/** 'YYYY-MM-DD' in local time for <input type="date"> defaults. */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
