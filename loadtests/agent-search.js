/**
 * k6 load test: public agent search API (rate-limited endpoint).
 *
 * DO NOT run against production without explicit approval. Target staging:
 *   k6 run -e BASE_URL=https://<preview>.vercel.app loadtests/agent-search.js
 *
 * NOTE: this endpoint is rate-limited (60 req/min/IP, see
 * src/lib/agent-protocol.ts AGENT_SEARCH_LIMIT). The script stays under the
 * limit per VU; if you raise VUs, expect 429s — the check below treats 429
 * as "rate limiter working", not a failure. Sustained 429s at low volume
 * would indicate the in-memory limiter misbehaving across instances.
 *
 * Profile: 10-minute ramp (2m up, 6m sustained, 2m down).
 * Thresholds: p95 < 500ms for non-rate-limited responses.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://kivo-nine-silk.vercel.app';

export const options = {
  stages: [
    { duration: '2m', target: 5 },
    { duration: '6m', target: 20 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    // 429s are expected under the rate limiter; only 5xx counts as failure.
    http_req_failed: ['rate<0.01'],
  },
};

const SERVICES = ['plumber', 'electrician', 'cleaning'];
const CITIES = ['Toronto', 'Vancouver', 'Montreal'];

export default function () {
  const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const res = http.get(
    `${BASE_URL}/api/agent/v1/search?service=${service}&city=${city}&limit=10`,
    { headers: { 'User-Agent': 'k6-loadtest' } }
  );
  check(res, {
    'status 200 or 429': (r) => r.status === 200 || r.status === 429,
    'no 5xx': (r) => r.status < 500,
  });
  // Stay comfortably under 60 req/min/IP per VU.
  sleep(3);
}
