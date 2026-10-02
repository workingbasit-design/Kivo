/**
 * k6 load test: /api/health (DB connectivity check).
 *
 * DO NOT run against production without explicit approval. Target staging:
 *   k6 run -e BASE_URL=https://<preview>.vercel.app loadtests/health.js
 *
 * This endpoint hits Postgres (SELECT 1), so it measures DB responsiveness
 * under load — the canary for connection-exhaustion issues.
 *
 * Profile: 10-minute ramp (2m up, 6m sustained, 2m down).
 * Thresholds: p95 < 500ms, error rate < 1%.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://kivo-nine-silk.vercel.app';

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '6m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    'status 200': (r) => r.status === 200,
    'db ok': (r) => r.json('db') === 'ok',
  });
  sleep(1);
}
