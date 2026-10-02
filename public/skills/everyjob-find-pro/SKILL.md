---
name: everyjob-find-pro
description: "Find a verified home-service pro on EveryJob: search the directory by service and city, read pro profiles."
---

# EveryJob: Find a Pro

Search EveryJob's directory of verified Canadian home-service pros (plumbers, electricians, cleaners, etc.) and read public pro profiles. Read-only. No authentication needed.

## Base URL

`https://kivo-nine-silk.vercel.app`

## Workflow

1. Search pros:
   `GET {base}/api/agent/v1/search?service=<keyword>&city=<city>&limit=<1-25>`
   - `service`: plain keyword, e.g. `plumber`, `electrician`, `cleaning`.
   - `city`: e.g. `Toronto`. Omit to search everywhere.
   - Returns verified, consenting pros only. Phone numbers are `null` when the pro hid them — never ask the customer to guess; offer the booking page link instead.
2. Read a pro profile:
   `GET {base}/api/agent/v1/pros/<slug>`
   - Services, prices, hours, rating, service area, booking link.
3. Present 2–3 options to the customer with: name, rating, price hint, service area, and booking link. Ask which pro before proposing anything.

## Rules

- Rate limit: 60 searches/minute per IP. Back off on 429.
- Never scrape HTML — use this API.
- Identify with a descriptive `User-Agent`.
- Do not invent pros, prices, or availability. Report only what the API returns.
- EveryJob is Canada-only, CAD only.
