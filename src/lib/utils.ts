/** Join class names, dropping falsy values. */
export function cn(
  ...inputs: Array<string | false | null | undefined>
): string {
  return inputs.filter(Boolean).join(" ");
}

/**
 * Whether a job's stored `time` counts as a real scheduled time.
 *
 * Jobs booked through Copilot before the TBD-sentinel fix stored the literal
 * display string "TBD" in the `time` column instead of NULL. Treat that
 * (and blanks) as "no time set" everywhere we display or edit the time,
 * so the sentinel never leaks into inputs, badges or WhatsApp messages.
 */
export function hasJobTime(time: string | null | undefined): time is string {
  if (!time) return false;
  const t = time.trim();
  return t !== "" && t.toUpperCase() !== "TBD";
}

/** Format a number as Indian Rupees, e.g. 6350 -> "Rs 6,350" */
export function formatINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "Rs 0";
  return "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** Format a Date/string as "Mon, Jan 5, 2026" */
export function formatDateLabel(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "—";
  let d: Date;
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    // Date-only strings: parse as LOCAL date, not UTC midnight (avoids
    // showing the previous day in timezones behind UTC).
    const [y, m, day] = dateInput.slice(0, 10).split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(dateInput);
  }
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a Date/string as "5 Jan 2026" */
export function formatDateShort(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "—";
  let d: Date;
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    // Date-only strings: parse as LOCAL date, not UTC midnight (avoids
    // showing the previous day in timezones behind UTC).
    const [y, m, day] = dateInput.slice(0, 10).split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(dateInput);
  }
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "YYYY-MM-DD" in local time (safe for <input type="date"> and day comparisons) */
export function toISODateLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Start/end of a local day as Dates (for Prisma day-range queries) */
export function dayRange(dateStr: string): { gte: Date; lte: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const gte = new Date(y, m - 1, d, 0, 0, 0, 0);
  const lte = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { gte, lte };
}

/** Status -> badge color classes */
export function statusClasses(status: string): string {
  switch (status) {
    case "IN PROGRESS":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "SCHEDULED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "COMPLETED":
    case "PAID":
    case "APPROVED":
    case "CONVERTED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "UNPAID":
    case "NEW":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
    case "CANCELLED":
    case "DECLINED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "SENT":
    case "CONTACTED":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "PARTIALLY PAID":
    case "DRAFT":
      return "bg-orange-50 text-orange-700 border-orange-200";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}
