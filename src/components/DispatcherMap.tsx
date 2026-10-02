'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Live map — Leaflet loaded from CDN (no npm dependency, no API key, free
 * OpenStreetMap tiles). Renders pins for jobs with technician locations; safe
 * for SSR (the map only initialises in the browser).
 *
 * Used by the dispatcher view (many pins) and reused by the public
 * /track/[token] page (single pin).
 */

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string;
  status?: string;
  /** Green pin when the tech has arrived, blue otherwise. */
  tone?: 'active' | 'arrived';
  /** ISO timestamp of the ping — shown as "updated Xm ago" in the popup. */
  updatedAt?: string;
}

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  fitBounds: (bounds: unknown) => LeafletMap;
  remove: () => void;
  on: (event: string, handler: () => void) => void;
  scrollWheelZoom: { enable: () => void };
};
type LeafletLayerGroup = {
  addTo: (m: LeafletMap) => LeafletLayerGroup;
  clearLayers: () => void;
};
type LeafletMarker = {
  bindPopup: (html: string) => { addTo: (l: LeafletLayerGroup) => void };
};
type LeafletNS = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (m: LeafletMap) => void };
  layerGroup: () => LeafletLayerGroup;
  divIcon: (opts: Record<string, unknown>) => unknown;
  latLngBounds: (pts: Array<[number, number]>) => { pad: (n: number) => unknown };
  marker: (pt: [number, number], opts?: Record<string, unknown>) => LeafletMarker;
};

function leaflet(): LeafletNS | null {
  return (window as unknown as { L?: LeafletNS }).L ?? null;
}

// divIcon markers avoid Leaflet's packaged image assets, whose paths break
// under bundlers/CDN.
function makeIcon(tone: 'active' | 'arrived'): unknown {
  const L = leaflet();
  if (!L) return undefined;
  const color = tone === 'arrived' ? '#16a34a' : '#2563eb';
  return L.divIcon({
    className: 'ej-map-pin',
    html:
      `<div style="width:28px;height:28px;border-radius:50%;background:${color};` +
      `border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);` +
      `display:flex;align-items:center;justify-content:center;">` +
      `<div style="width:8px;height:8px;border-radius:50%;background:#fff;"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

let leafletLoadPromise: Promise<void> | null = null;

const LEAFLET_TIMEOUT_MS = 15000;

function loadLeaflet(): Promise<void> {
  if (leafletLoadPromise) return leafletLoadPromise;
  leafletLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('no window'));
      return;
    }
    if (leaflet()) {
      resolve();
      return;
    }
    // Timeout: on slow/blocked networks the script tag may never fire
    // onload/onerror — don't leave the UI spinning forever.
    const timer = setTimeout(() => {
      leafletLoadPromise = null; // allow a later retry
      reject(new Error('Leaflet load timed out'));
    }, LEAFLET_TIMEOUT_MS);
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      leafletLoadPromise = null; // allow a later retry
      reject(new Error('Leaflet failed to load'));
    };
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(iso?: string): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return hrs === 1 ? '1 hr ago' : `${hrs} hr ago`;
}

export default function DispatcherMap({
  pins,
  height = 420,
  className,
}: {
  pins: MapPin[];
  height?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletLayerGroup | null>(null);
  const pinsRef = useRef<MapPin[]>(pins);
  // (pinsRef sync moved below, next to drawRef — effects only, never during render)
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Draw (or redraw) the current pins. Called after init and whenever pins change.
  // fitBounds only runs when pins first appear or the pin set changes — never
  // on plain position updates, so the map doesn't snap the user's view away
  // every 30 seconds while a tech is moving.
  const fittedRef = useRef(false);
  const drawPins = (forceFit = false) => {
    const L = leaflet();
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const pts = pinsRef.current.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
    );
    for (const p of pts) {
      const ago = timeAgo(p.updatedAt);
      L.marker([p.lat, p.lng], { icon: makeIcon(p.tone ?? 'active') })
        .bindPopup(
          `<strong>${escapeHtml(p.label)}</strong>` +
            (p.sub ? `<br/>${escapeHtml(p.sub)}` : '') +
            (p.status ? `<br/><em>${escapeHtml(p.status)}</em>` : '') +
            (ago ? `<br/><span style="color:#71717a;font-size:12px;">Updated ${escapeHtml(ago)}</span>` : '')
        )
        .addTo(layer);
    }
    const shouldFit = forceFit || !fittedRef.current;
    if (pts.length > 0 && shouldFit) {
      map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])).pad(0.2));
      fittedRef.current = true;
    }
    if (pts.length === 0) fittedRef.current = false;
  };
  const drawRef = useRef(drawPins);
  // Keep the "latest value" mirrors in effects — reading/writing refs during
  // render is not allowed. Declared before the init/redraw effects so they
  // always see fresh values (effects run in declaration order).
  useEffect(() => {
    pinsRef.current = pins;
  });
  useEffect(() => {
    drawRef.current = drawPins;
  });

  const recenter = () => drawRef.current(true);

  // Init once (re-runs when the user taps Retry after a failure).
  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    setMapFailed(false);
    loadLeaflet()
      .then(() => {
        if (cancelled || !el) return;
        const L = leaflet();
        if (!L) {
          if (!cancelled) setMapFailed(true);
          return;
        }
        const map = L.map(el, { scrollWheelZoom: false }).setView([43.6532, -79.3832], 10);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        // Enable scroll zoom only after an explicit click, so the map never
        // hijacks page scroll on mobile.
        map.on('click', () => map.scrollWheelZoom.enable());
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        drawRef.current();
        if (!cancelled) setMapReady(true);
      })
      .catch(() => {
        // Graceful degradation: show a fallback with retry instead of a
        // stuck spinner. The surrounding list views work without tiles.
        if (!cancelled) setMapFailed(true);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Redraw when pins change (e.g. a polling parent refetches /api/locations/latest).
  useEffect(() => {
    drawRef.current();
  }, [pins]);

  return (
    <div className="relative" style={{ height, width: '100%' }}>
      {!mapReady && !mapFailed && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl bg-zinc-100"
          aria-hidden={mapReady}
        >
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-lime-500" />
            <span className="text-xs font-medium">Loading map…</span>
          </div>
        </div>
      )}
      {mapFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-zinc-100 px-6 text-center">
          <p className="text-sm text-zinc-500">
            Map unavailable — check your connection. The job list below is still up to date.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Retry map
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className={className}
        style={{ height, width: '100%', borderRadius: 16, zIndex: 0 }}
        role="img"
        aria-label="Live map of technician locations"
      />
      {mapReady && (
        <button
          type="button"
          onClick={recenter}
          className="absolute bottom-3 right-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-zinc-700 shadow-md border border-zinc-200 hover:bg-white"
          aria-label="Recenter map on technician locations"
        >
          ⌖ Recenter
        </button>
      )}
    </div>
  );
}
