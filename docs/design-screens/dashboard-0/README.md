# Part 0 — existing screens with demo data

Screenshots of the current (pre-rebuild) screens, rendered against the seeded
demo business ("Maple Leaf Home Services (Demo)", `scripts/seed-demo.ts`).

- Viewports: 390×844 and 430×932 (mobile, Firefox)
- Locales: EN (`-en`) and FR (`-fr`, via the `kivo-locale` cookie)
- Theme: light only — the app has no dark mode yet (dark is Part B work).
- The amber "Demo business: sample data only" banner is visible on every shot.
- `settings-demo-switch-390-en.png`: the owner-only Settings card that opens
  the demo business.

How they were captured: `scripts/shots-demo-0.mjs` against a local Postgres
with `npm run seed:demo` applied (never production).
