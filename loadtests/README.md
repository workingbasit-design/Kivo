# Load tests (playbook layer 15a)

k6 scripts for the 5 key endpoints. **Do NOT run against production without
explicit approval** — target a staging/preview deployment via `BASE_URL`.

```sh
# Install k6: https://k6.io/docs/get-started/installation/
k6 run -e BASE_URL=https://<preview>.vercel.app loadtests/homepage.js
k6 run -e BASE_URL=https://<preview>.vercel.app loadtests/login-page.js
k6 run -e BASE_URL=https://<preview>.vercel.app loadtests/health.js
k6 run -e BASE_URL=https://<preview>.vercel.app loadtests/agent-search.js

# Dashboard needs a session cookie (see script header):
k6 run -e BASE_URL=https://<preview>.vercel.app \
  -e SESSION_COOKIE=<kivo_session value> loadtests/dashboard-authed.js
```

| Script | Endpoint | Profile | Notes |
|---|---|---|---|
| `homepage.js` | `GET /` | 2m→10 VUs, 6m→50, 2m→0 | Public landing page |
| `login-page.js` | `GET /login` | 2m→10 VUs, 6m→50, 2m→0 | SSR + session lookup path |
| `health.js` | `GET /api/health` | 2m→10 VUs, 6m→50, 2m→0 | Hits Postgres; canary for connection exhaustion |
| `dashboard-authed.js` | `GET /dashboard` | 2m→5 VUs, 6m→25, 2m→0 | **Requires `SESSION_COOKIE`**; heaviest SSR page |
| `agent-search.js` | `GET /api/agent/v1/search` | 2m→5 VUs, 6m→20, 2m→0 | Rate-limited (60/min/IP); 429 expected, 5xx is failure |

Thresholds (all scripts): `p(95) < 500ms`, error rate `< 1%`.

Findings and remediation order: see [../docs/scaling-review.md](../docs/scaling-review.md).
