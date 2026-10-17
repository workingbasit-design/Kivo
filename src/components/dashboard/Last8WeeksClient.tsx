"use client";

/**
 * Part C (dashboard rebuild): the "Show the numbers" data table for the
 * Last-8-weeks chart (screen-reader and low-vision access to the chart).
 */
import { useState } from "react";
import type { WeekPoint } from "@/lib/dashboard-sections";
import { formatMoney } from "@/lib/money";

export default function Last8WeeksClient({
  weeks,
  locale,
  showLabel,
  hideLabel,
  weekLabel,
  collectedLabel,
  invoicedLabel,
}: {
  weeks: WeekPoint[];
  locale: "en" | "fr";
  showLabel: string;
  hideLabel: string;
  weekLabel: string;
  collectedLabel: string;
  invoicedLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-[44px] items-center px-1 text-[14px] font-semibold text-asphalt underline underline-offset-2 dark:text-zinc-300"
      >
        {open ? hideLabel : showLabel}
      </button>
      {open && (
        <table className="mt-2 w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-ink-2 dark:border-white/10 dark:text-zinc-400">
              <th scope="col" className="py-2 pr-2 font-medium">{weekLabel}</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">{collectedLabel}</th>
              <th scope="col" className="py-2 text-right font-medium">{invoicedLabel}</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.key} className="border-b border-line last:border-0 dark:border-white/5">
                <th scope="row" className="py-2 pr-2 font-medium text-asphalt dark:text-white">
                  {w.key}
                </th>
                <td className="py-2 pr-2 text-right tabular-nums text-asphalt dark:text-zinc-200">
                  {formatMoney(w.collected, null, locale)}
                </td>
                <td className="py-2 text-right tabular-nums text-asphalt dark:text-zinc-200">
                  {formatMoney(w.invoiced, null, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
