/**
 * k6 load test: public homepage.
 *
 * DO NOT run against production without explicit approval — this generates
 * real traffic. Target a staging/preview deployment instead:
 *   k6 run -e BASE_URL=https://<preview>.vercel.app loadtests/homepage.js
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
  const res = http.get(`${BASE_URL}/`);
  check(res, {
    'status 200': (r) => r.status === 200,
    'has content': (r) => r.body.length > 1000,
  });
  sleep(1);
}
