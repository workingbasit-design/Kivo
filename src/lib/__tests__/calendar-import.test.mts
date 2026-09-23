/**
 * Unit tests for Google Calendar import pure logic (src/lib/google-calendar.ts
 * — Track 6B). All HTTP is mocked; no live Google calls.
 * Run: node --test src/lib/__tests__/calendar-import.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapCalendarEvent,
  fetchCalendarEvents,
  type GoogleApiCalendarEvent,
} from '@/lib/google-calendar.ts';

function mockFetch(
  handler: (url: string, init?: RequestInit) => { ok: boolean; status: number; body: unknown }
) {
  return (async (url: unknown, init?: RequestInit) => {
    const r = handler(String(url), init);
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body,
    };
  }) as unknown as typeof fetch;
}

test('mapCalendarEvent maps a normal timed event', () => {
  const d = mapCalendarEvent({
    id: 'evt1',
    status: 'confirmed',
    summary: 'Fix water heater',
    description: 'Bring new element',
    location: '42 Rue Main',
    start: { dateTime: '2026-10-05T09:30:00-04:00' },
    end: { dateTime: '2026-10-05T11:00:00-04:00' },
  });
  assert.ok(d);
  assert.equal(d.googleEventId, 'evt1');
  assert.equal(d.title, 'Fix water heater');
  assert.equal(d.startISO, '2026-10-05T13:30:00.000Z');
  assert.equal(d.endISO, '2026-10-05T15:00:00.000Z');
  assert.equal(d.description, 'Bring new element');
  assert.equal(d.location, '42 Rue Main');
});

test('mapCalendarEvent keeps all-day events (start.date)', () => {
  const d = mapCalendarEvent({
    id: 'evt2',
    summary: 'Stat holiday',
    start: { date: '2026-10-12' },
    end: { date: '2026-10-13' },
  });
  assert.ok(d);
  assert.equal(d.startISO, '2026-10-12T00:00:00.000Z');
  assert.equal(d.endISO, '2026-10-13T00:00:00.000Z');
  assert.equal(d.description, null);
  assert.equal(d.location, null);
});

test('mapCalendarEvent skips cancelled events and events without a start', () => {
  assert.equal(
    mapCalendarEvent({ id: 'x', status: 'cancelled', summary: 'Gone', start: { dateTime: '2026-10-01T10:00:00Z' } }),
    null
  );
  assert.equal(
    mapCalendarEvent({ id: 'y', summary: 'No start' } as GoogleApiCalendarEvent),
    null
  );
  assert.equal(
    mapCalendarEvent({ id: 'z', summary: 'Bad start', start: { dateTime: 'not-a-date' } }),
    null
  );
});

test('mapCalendarEvent falls back to Untitled event for blank summaries', () => {
  const d = mapCalendarEvent({ id: 'u', start: { dateTime: '2026-10-01T10:00:00Z' } });
  assert.ok(d);
  assert.equal(d.title, 'Untitled event');
});

test('fetchCalendarEvents follows nextPageToken and sends required params', () => {
  const seenUrls: string[] = [];
  const f = mockFetch((url) => {
    seenUrls.push(url);
    if (url.includes('pageToken=tok2')) {
      return { ok: true, status: 200, body: { items: [{ id: 'e2', start: { date: '2026-10-02' } }] } };
    }
    return {
      ok: true,
      status: 200,
      body: {
        items: [{ id: 'e1', summary: 'One', start: { dateTime: '2026-10-01T10:00:00Z' } }],
        nextPageToken: 'tok2',
      },
    };
  });
  return fetchCalendarEvents('TOKEN', '2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z', f).then(
    (events) => {
      assert.equal(events.length, 2);
      assert.equal(events[0].id, 'e1');
      assert.equal(events[1].id, 'e2');
      const first = seenUrls[0];
      assert.ok(first.includes('singleEvents=true'));
      assert.ok(first.includes('orderBy=startTime'));
      assert.ok(first.includes('maxResults=100'));
      assert.ok(first.includes('timeMin=2026-10-01T00%3A00%3A00.000Z'));
      assert.ok(first.includes('timeMax=2026-10-31T00%3A00%3A00.000Z'));
      assert.ok(!first.includes('pageToken'));
    }
  );
});

test('fetchCalendarEvents caps pagination at 5 pages', () => {
  let calls = 0;
  const f = mockFetch(() => {
    calls += 1;
    return { ok: true, status: 200, body: { items: [], nextPageToken: 'always' } };
  });
  return fetchCalendarEvents('TOKEN', '2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z', f).then(
    () => assert.equal(calls, 5)
  );
});

test('fetchCalendarEvents sends the bearer token and classifies errors', async () => {
  let auth = '';
  const f = mockFetch((_url, init) => {
    auth = String(init?.headers && (init.headers as Record<string, string>)['Authorization']);
    return { ok: false, status: 401, body: {} };
  });
  await assert.rejects(
    fetchCalendarEvents('TOKEN', '2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z', f),
    (e: unknown) => {
      assert.equal((e as { kind?: string }).kind, 'reauth');
      assert.equal(auth, 'Bearer TOKEN');
      return true;
    }
  );
});

/* ------------------------------------------------------------------ */
/* zonedDayAndTime + localMidnight (Track 6 follow-up)                  */
/* ------------------------------------------------------------------ */
import { zonedDayAndTime, localMidnight } from '@/lib/google-calendar.ts';

test('zonedDayAndTime converts UTC event start to America/Toronto local time', () => {
  // 2026-09-23T13:30:00Z is 09:30 EDT in Toronto.
  const r = zonedDayAndTime(new Date('2026-09-23T13:30:00.000Z'), 'America/Toronto');
  assert.equal(r.day, '2026-09-23');
  assert.equal(r.hhmm, '09:30');
});

test('zonedDayAndTime rolls the day back when UTC is after local midnight', () => {
  // 2026-09-23T03:00:00Z is 23:00 EDT on Sep 22 in Toronto.
  const r = zonedDayAndTime(new Date('2026-09-23T03:00:00.000Z'), 'America/Toronto');
  assert.equal(r.day, '2026-09-22');
  assert.equal(r.hhmm, '23:00');
});

test('zonedDayAndTime respects other Canadian timezones', () => {
  // 2026-09-23T13:30:00Z is 06:30 PDT in Vancouver.
  const r = zonedDayAndTime(new Date('2026-09-23T13:30:00.000Z'), 'America/Vancouver');
  assert.equal(r.day, '2026-09-23');
  assert.equal(r.hhmm, '06:30');
});

test('localMidnight builds a midnight Date matching "YYYY-MM-DD"', () => {
  const d = localMidnight('2026-09-23');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);
  assert.equal(d.getDate(), 23);
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
});
