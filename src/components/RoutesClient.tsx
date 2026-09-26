'use client';

import React, { useState, useTransition } from 'react';
import {
  Route as RouteIcon, ArrowUp, ArrowDown, Play, X, ChevronLeft, ChevronRight,
  CheckCircle2, MapPin, Clock, RotateCcw, AlertCircle, Car, Loader2,
  MapPinOff, Info, Navigation,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, StatusBadge, primaryBtnClass, secondaryBtnClass, inputClass } from '@/components/ui';
import { hasJobTime, cn, jobDisplayStatus } from '@/lib/utils';
import type { RouteStop } from '@/lib/routes';
import { googleMapsRouteUrl } from '@/lib/routes';
import { optimizeDayRoute } from '@/app/actions/routes';
import { updateJobStatus } from '@/app/actions/jobs';
import { formatMoney } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';

/**
 * Interactive route planner for the day's stops.
 *
 * - "Optimize route" calls a server action that geocodes each address
 *   (OpenStreetMap Nominatim) and computes the visit order from REAL
 *   driving times (OSRM), with per-leg distance/ETA and totals.
 * - Up/down buttons let the user fine-tune the order manually
 *   (manual moves clear the per-leg driving figures).
 * - "Start route" walks through one stop at a time with a complete button.
 * - The order lives in UI state for this session — nothing is persisted
 *   to the database.
 */
export default function RoutesClient({
  initialStops,
  dateStr,
  currency,
  locale,
  fullRouteLabel,
}: {
  initialStops: RouteStop[];
  dateStr: string;
  currency?: string;
  locale: Locale;
  fullRouteLabel: string;
}) {
  const [stops, setStops] = useState<RouteStop[]>(initialStops);
  const [optimized, setOptimized] = useState(false);
  const [optimizing, startOptimizing] = useTransition();
  const [optError, setOptError] = useState<string | null>(null);
  const [totals, setTotals] = useState<{ totalKm: number | null; totalMinutes: number | null } | null>(null);
  const [unlocated, setUnlocated] = useState<RouteStop[]>([]);
  const [attribution, setAttribution] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completing, startCompleting] = useTransition();
  const [completeError, setCompleteError] = useState<string | null>(null);

  const T = (k: string) => t(locale, `t10work.${k}`);
  const common = (k: string) => t(locale, `common.${k}`);

  const optimize = () => {
    setOptError(null);
    startOptimizing(async () => {
      try {
        const res = await optimizeDayRoute(dateStr);
        if ('error' in res) {
          setOptError(res.error);
          toast.error(res.error);
          return;
        }
        setStops(res.stops);
        setUnlocated(res.unlocated);
        setTotals({ totalKm: res.totalKm, totalMinutes: res.totalMinutes });
        setAttribution(res.attribution);
        setOptimized(true);
        setCurrentIdx(0);
        toast.success(T('routesOptimizedToast'));
      } catch {
        const msg = common('retry');
        setOptError(msg);
        toast.error(msg);
      }
    });
  };

  const resetOrder = () => {
    setStops([...initialStops]);
    setOptimized(false);
    setTotals(null);
    setUnlocated([]);
    setAttribution(null);
    setOptError(null);
    setCurrentIdx(0);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= stops.length) return;
    const copy = [...stops];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    // Manual reorder invalidates the per-leg driving figures.
    const cleared = copy.map((s) => ({ ...s, legKm: null, legMinutes: null }));
    setStops(cleared);
    setOptimized(false);
    setTotals(null);
  };

  const startRoute = () => {
    setRouteMode(true);
    setCurrentIdx(0);
  };

  const markComplete = (jobId: string) => {
    setCompleteError(null);
    startCompleting(async () => {
      const res = await updateJobStatus(jobId, 'COMPLETED');
      if (res.error) {
        setCompleteError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(T('routesStopCompleted'));
      setStops((prev) =>
        prev.map((s) => (s.id === jobId ? { ...s, status: 'COMPLETED' } : s))
      );
      // The completed stop drops out of `remaining`, so the next stop slides
      // into the current index — clamp rather than advancing.
      setCurrentIdx((i) => {
        const newRemaining = stops.filter(
          (s) => s.id !== jobId && s.status !== 'COMPLETED'
        );
        return Math.min(i, Math.max(0, newRemaining.length - 1));
      });
    });
  };

  const remaining = stops.filter((s) => s.status !== 'COMPLETED');

  // One tap to open the whole day's route (current stop order) in Google
  // Maps. Follows re-orders and optimization because it reads live state.
  const fullRouteUrl = googleMapsRouteUrl(stops);

  const legLine = (stop: RouteStop) =>
    stop.legKm != null || stop.legMinutes != null ? (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
        <Car size={13} className="shrink-0" />
        {stop.legKm != null ? `${stop.legKm} km` : '—'}
        {stop.legMinutes != null ? ` · ~${stop.legMinutes} min` : ''}
      </p>
    ) : null;

  return (
    <div className="space-y-5">
      {/* Date picker + actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <form method="GET" action="/routes" className="flex items-center gap-2">
          <label htmlFor="route-date" className="sr-only">
            {T('routesRouteDate')}
          </label>
          <input
            id="route-date"
            type="date"
            name="date"
            defaultValue={dateStr}
            onChange={(e) => e.target.form?.requestSubmit()}
            className={cn(inputClass, '!w-auto')}
            aria-label={T('routesRouteDate')}
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={optimize}
            disabled={optimizing}
            className={secondaryBtnClass + ' disabled:opacity-50'}
          >
            {optimizing ? <Loader2 size={14} className="animate-spin" /> : <RouteIcon size={14} />}
            {optimizing ? T('routesOptimizing') : T('routesOptimize')}
          </button>
          <button type="button" onClick={resetOrder} className={secondaryBtnClass}>
            <RotateCcw size={14} /> {T('routesReset')}
          </button>
          <button type="button" onClick={startRoute} className={primaryBtnClass}>
            <Play size={14} /> {T('routesStart')}
          </button>
          {fullRouteUrl && (
            <a
              href={fullRouteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryBtnClass}
            >
              <Navigation size={14} /> {fullRouteLabel}
            </a>
          )}
        </div>
      </div>

      {optError && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <AlertCircle size={14} /> {optError}
        </p>
      )}

      {optimized && totals && (
        <div className="text-xs text-zinc-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 space-y-1">
          <p className="font-bold text-emerald-800">
            {T('routesOptimizedTitle')}
            {totals.totalKm != null && <> · {T('routesKmTotal').replace('{km}', String(totals.totalKm))}</>}
            {totals.totalMinutes != null && <> · {T('routesMinTotal').replace('{min}', String(totals.totalMinutes))}</>}
          </p>
          {attribution && (
            <p className="flex items-start gap-1.5 text-[11px] text-zinc-500">
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>{T('routesRoutingNote').replace('{attribution}', attribution)}</span>
            </p>
          )}
        </div>
      )}

      {unlocated.length > 0 && (
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-2">
            <MapPinOff size={14} /> {T('routesCouldNotLocate').replace('{count}', String(unlocated.length))}
          </p>
          <ul className="space-y-1.5">
            {unlocated.map((s) => (
              <li key={s.id} className="text-xs text-zinc-600">
                <span className="font-semibold text-zinc-800">{s.title}</span>
                <span className="text-zinc-400">
                  {' '}— {s.address ? T('routesGeocodeFailed') : T('routesNoAddress')}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-zinc-400 mt-2">
            {T('routesFixAddress')}
          </p>
        </Card>
      )}

      {completeError && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <AlertCircle size={14} /> {completeError}
        </p>
      )}

      {/* Route mode: one stop at a time */}
      {routeMode ? (
        <Card className="p-6 md:p-8">
          {remaining.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
              <h3 className="font-bold text-zinc-900">{T('routesComplete')}</h3>
              <p className="text-sm text-zinc-500 mt-1">
                {T('routesAllDone').replace('{count}', String(stops.length))}
              </p>
              <button
                type="button"
                onClick={() => setRouteMode(false)}
                className={secondaryBtnClass + ' mt-5'}
              >
                <X size={14} /> {T('routesExit')}
              </button>
            </div>
          ) : (
            (() => {
              const idx = Math.min(currentIdx, remaining.length - 1);
              const stop = remaining[idx];
              return (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      {T('routesStopOf').replace('{i}', String(idx + 1)).replace('{n}', String(remaining.length))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRouteMode(false)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                      aria-label={T('routesExitRoute')}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">{stop.title}</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">{stop.customerName}</p>
                  </div>

                  <div className="space-y-2 text-sm">
                    {stop.address && (
                      <p className="flex items-start gap-2 text-zinc-700">
                        <MapPin size={15} className="text-zinc-400 mt-0.5 shrink-0" />
                        {stop.address}
                      </p>
                    )}
                    {stop.address && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 min-h-[44px] text-ink font-semibold hover:underline"
                      >
                        <Navigation size={15} className="shrink-0" />
                        {T('routesDirections')}
                      </a>
                    )}
                    {legLine(stop)}
                    {hasJobTime(stop.time) && (
                      <p className="flex items-center gap-2 text-zinc-700">
                        <Clock size={15} className="text-zinc-400 shrink-0" />
                        {stop.time}
                      </p>
                    )}
                    <p className="font-bold text-zinc-900 tabular-nums">{formatMoney(stop.price, currency)}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => setCurrentIdx(idx - 1)}
                      className={secondaryBtnClass + ' disabled:opacity-40'}
                    >
                      <ChevronLeft size={14} /> {common('back')}
                    </button>
                    <button
                      type="button"
                      disabled={completing || idx >= remaining.length - 1}
                      onClick={() => setCurrentIdx(idx + 1)}
                      className={secondaryBtnClass + ' disabled:opacity-40'}
                    >
                      {T('routesSkip')} <ChevronRight size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={completing}
                      onClick={() => markComplete(stop.id)}
                      className={primaryBtnClass + ' sm:flex-1'}
                    >
                      <CheckCircle2 size={14} />
                      {completing ? common('saving') : T('routesMarkComplete')}
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </Card>
      ) : (
        /* Stop list */
        <div className="space-y-2.5">
          {stops.map((stop, i) => (
            <Card
              key={stop.id}
              className="p-4 flex items-center gap-3 ej-row-in"
              style={{ '--row-delay': `${Math.min(i, 10) * 40}ms` } as React.CSSProperties}
            >
              <div className="w-8 h-8 rounded-xl bg-ink text-white flex items-center justify-center text-sm font-bold shrink-0 tabular-nums">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-900 truncate">{stop.title}</p>
                <p className="text-xs text-zinc-500 truncate">
                  {stop.customerName}
                  {stop.address ? ` · ${stop.address}` : ''}
                  {hasJobTime(stop.time) ? ` · ${stop.time}` : ''}
                </p>
                {i > 0 && legLine(stop)}
              </div>
              <div className="hidden sm:block">
                <StatusBadge status={jobDisplayStatus(stop.status, dateStr)} />
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30"
                  aria-label={T('routesMoveUp')}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  disabled={i === stops.length - 1}
                  onClick={() => move(i, 1)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30"
                  aria-label={T('routesMoveDown')}
                >
                  <ArrowDown size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
