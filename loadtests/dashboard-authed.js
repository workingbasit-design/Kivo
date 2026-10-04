/**
 * k6 load test: authenticated dashboard (heaviest SSR page).
 *
 * AUTH SETUP REQUIRED — this script does NOT run as-is. Steps:
 *   1. In a real browser, log in to the target deployment as a test user.
 *   2. Copy the `kivo_session` cookie value from devtools.
 *   3. Run: k6 run -e BASE_URL=https://<staging>.vercel.app
 *                -e SESSION_COOKIE=<value> loadtests/dashboard-authed.js
 *
 * DO NOT run against production without explicit approval, and NEVER use a
 * real user's session — use a dedicated load-test account on staging.
 *
 * Profile: 10-minute ramp (2m up, 6m sustained, 2m down).
 * Thresholds: p95 < 500ms, error rate < 1%.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://kivo-nine-silk.vercel.app';
const SESSION_COOKIE = __ENV.SESSION_COOKIE || '';

export const options = {
  stages: [
    { duration: '2m', target: 5 },
    { duration: '6m', target: 25 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
  setupTimeout: '30s',
};

export function setup() {
  if (!SESSION_COOKIE) {
    throw new Error(
      'SESSION_COOKIE env var is required. Log in on the target deployment, copy the kivo_session cookie, and pass -e SESSION_COOKIE=<value>.'
    );
  }
}

export default function dashboardAuthedLoad() {
  const jar = http.cookieJar();
  jar.set(BASE_URL, 'kivo_session', SESSION_COOKIE);
  const res = http.get(`${BASE_URL}/dashboard`);
  check(res, {
    'status 200 (not redirected to login)': (r) => r.status === 200,
    'dashboard rendered': (r) => r.body.length > 2000,
  });
  sleep(2);
}
