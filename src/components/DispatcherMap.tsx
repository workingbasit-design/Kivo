'use client';

import { useEffect, useRef } from 'react';

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
}

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

type LeafletNS = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => any;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (m: any) => void };
  layerGroup: () => any;
  divIcon: (opts: Record<string, unknown>) => unknown;
  latLngBounds: (pts: Array<[number, number]>) => { pad: (n: number) => unknown };
  marker: (pt: [number, number], opts?: Record<string, unknown>) => {
    bindPopup: (html: string) => { addTo: (l: any) => void };
  };
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
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Leaflet failed to load'));
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
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const pinsRef = useRef<MapPin[]>(pins);
  pinsRef.current = pins;

  // Draw (or redraw) the current pins. Called after init and whenever pins change.
  const drawPins = () => {
    const L = leaflet();
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const pts = pinsRef.current.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
    );
    for (const p of pts) {
      L.marker([p.lat, p.lng], { icon: makeIcon(p.tone ?? 'active') })
        .bindPopup(
          `<strong>${escapeHtml(p.label)}</strong>` +
            (p.sub ? `<br/>${escapeHtml(p.sub)}` : '') +
            (p.status ? `<br/><em>${escapeHtml(p.status)}</em>` : '')
        )
        .addTo(layer);
    }
    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])).pad(0.2));
    }
  };
  const drawRef = useRef(drawPins);
  drawRef.current = drawPins;

  // Init once.
  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    loadLeaflet()
      .then(() => {
        if (cancelled || !el) return;
        const L = leaflet();
        if (!L) return;
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
      })
      .catch(() => {
        // Graceful degradation: surrounding list views still work without tiles.
        if (el && !cancelled) {
          el.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#71717a;font-size:14px;padding:24px;text-align:center;">Map unavailable — the job list is still up to date.</div>';
        }
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
  }, []);

  // Redraw when pins change (e.g. a polling parent refetches /api/locations/latest).
  useEffect(() => {
    drawRef.current();
  }, [pins]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: '100%', borderRadius: 16, zIndex: 0 }}
      role="img"
      aria-label="Live map of technician locations"
    />
  );
}
