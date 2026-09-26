import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { clientIpFromHeaders } from '@/lib/client-ip';

/**
 * Free address autocomplete proxy — OpenStreetMap Nominatim (no API key).
 * Deliberately unauthenticated: also used by the public booking page.
 * Returns only the safe fields the UI needs; never leaks raw Nominatim internals.
 */

export interface PlaceSuggestion {
  displayName: string;
  lat: string;
  lon: string;
  type: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LIMIT = 5;

type CacheEntry = { at: number; data: PlaceSuggestion[] };
const cache = new Map<string, CacheEntry>();

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  }
}

function clientIp(req: NextRequest): string {
  return (
    clientIpFromHeaders(req.headers)
  );
}

export async function GET(req: NextRequest) {
  // CSRF/origin guard: this endpoint is read-only and intentionally public
  // (used by the public booking page), but a mismatched Origin/Referer is
  // never legitimate — reject it. Absent headers (curl/server-side) pass.
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden(originCheck.reason);

  const ip = clientIp(req);
  const rl = rateLimit(`places:${ip}`, { limit: 30, windowMs: 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] as PlaceSuggestion[] });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: 'Query too long.' }, { status: 400 });
  }

  const cacheKey = q.toLowerCase();
  pruneCache();
  const hit = cache.get(cacheKey);
  if (hit) {
    return NextResponse.json(
      { suggestions: hit.data },
      { headers: { 'Cache-Control': 'public, max-age=240' } }
    );
  }

  try {
    const url =
      'https://nominatim.openstreetmap.org/search?' +
      new URLSearchParams({
        format: 'jsonv2',
        addressdetails: '1',
        limit: String(LIMIT),
        q,
      }).toString();

    const res = await fetch(url, {
      headers: {
        // Nominatim usage policy requires a descriptive User-Agent.
        'User-Agent': 'EveryJobApp/1.0 (address autocomplete)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Address lookup is temporarily unavailable. Please type the address manually.' },
        { status: 502 }
      );
    }

    const raw = (await res.json()) as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
      type?: string;
    }>;

    const suggestions: PlaceSuggestion[] = (Array.isArray(raw) ? raw : [])
      .slice(0, LIMIT)
      .filter((r) => r.display_name && r.lat && r.lon)
      .map((r) => ({
        displayName: String(r.display_name),
        lat: String(r.lat),
        lon: String(r.lon),
        type: String(r.type ?? ''),
      }));

    cache.set(cacheKey, { at: Date.now(), data: suggestions });

    return NextResponse.json(
      { suggestions },
      { headers: { 'Cache-Control': 'public, max-age=240' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Address lookup is temporarily unavailable. Please type the address manually.' },
      { status: 502 }
    );
  }
}
