# Kivo — Launch Checklist

Everything to verify and decide before, during, and after going live.
Companion doc: `DEPLOY.md` (the how). This is the what-and-when.

---

## DECISIONS THE USER MUST MAKE (nothing ships until these are answered)

1. **Hosting provider** — Vercel, Railway, Fly.io, or a VPS. See `DEPLOY.md`
   §1 for trade-offs. (No pick is made for you.)
2. **Domain name** — e.g. `kivo.app` / `getkivo.in`. Needed for DNS, TLS, and
   share-link URLs.
3. **Postgres provider** — Neon, Supabase, Railway Postgres, RDS, or
   self-hosted. Needed for `DATABASE_URL`.
4. **Admin email(s)** — who gets access to the `/directory-reports`
   moderation queue (`KIVO_ADMIN_EMAILS`, comma-separated). Can be just you.
5. **Anthropic API key** — set `ANTHROPIC_API_KEY` for Claude-powered copilot
   replies, or skip it: the built-in rule-based copilot is fully functional
   and was the tested default. This can be decided after launch (no redeploy
   needed on most hosts — just set the env var and restart).

---

## PRE-LAUNCH (days before)

### Product & code
- [ ] `npx tsc --noEmit` clean — **verified 2026-09-22**
- [ ] `npm run build` green — **verified 2026-09-22**
- [ ] Final QA matrix green — **79/79 release pass + 39/39 directory pass,
      verified 2026-09-22** (`TEST_REPORT.md`, `DIR_NOTES.md`)
- [ ] `prisma/migrations` baseline generated from the schema and committed
      (see `DEPLOY.md` §3 — the repo currently uses `db push`, no migrations
      dir yet)

### Infrastructure
- [ ] Postgres provisioned; `DATABASE_URL` works from the app host
      (`npx prisma migrate deploy` succeeds)
- [ ] `NODE_ENV=production` set
- [ ] Secrets stored in the host's secret manager (never in git)
- [ ] Domain DNS pointed at the host (user action — not done by the agent)
- [ ] TLS certificate active (automatic on Vercel/Railway/Fly; certbot on VPS)
- [ ] Automated DB backups + point-in-time recovery enabled; **one restore
      tested to a scratch DB**

### Safety & legal (founder tasks)
- [ ] Privacy policy + terms of service pages (businesses own their customer
      data — say so plainly)
- [ ] Decide the abuse contact for directory reports (the admin email above)
- [ ] Confirm: Kivo processes no money (UPI/payment details are display-only)
      — no PCI scope, but say it in the terms

---

## LAUNCH DAY (in order)

1. Deploy the build (`DEPLOY.md` §5) with production env vars.
2. Run `npx prisma migrate deploy`; confirm `npx prisma migrate status`
   shows everything applied.
3. Health check (`DEPLOY.md` §6): `/login` → 200.
4. **Smoke test on the live URL** (do not skip):
   - Register a business → dashboard loads
   - Customer → job → quote → invoice → payment (invoice shows PAID)
   - Public booking page loads unauthenticated; test booking creates a lead
   - `/directory` search → `/p/[slug]` profile → quote request → lead draft
     appears in the provider inbox
   - Share-token link (`/q/[token]`) opens publicly; revoke it and confirm
     it shows "link invalid or expired"
   - AI copilot answers a question (rule-based is fine)
5. **Delete the smoke-test business** (keep production data clean from minute
   one).
6. Confirm backups ran at least once on the schedule.
7. Announce: your first users. Suggested first cohort — 3–5 friendly service
   businesses (one each: e.g. plumber, electrician, cleaner) who agree to
   give feedback weekly.

---

## POST-LAUNCH (first 30 days)

### Monitoring (founder habit, weekly)
- [ ] Uptime check on `/login` (any uptime monitor; alert on non-200)
- [ ] Error logs review — look for 500s, Prisma connection errors,
      unique-constraint retries from recurring generation
- [ ] DB size and backup success
- [ ] Rate-limit 429s: occasional is fine (bots); a flood from one IP may
      need a block

### First-user onboarding
- [ ] Walk each pilot business through setup personally (business profile,
      WhatsApp number, working hours, price book, booking page link)
- [ ] Confirm their public directory profile looks right (`/p/[slug]`)
- [ ] Ask for one review via the review-request flow — social proof seeds
      the directory
- [ ] Collect feedback: what took >20 seconds? (job creation target)

### Known limitations to watch (from `RELEASE_NOTES.md` accepted risks)
- Single-instance assumption: do **not** scale to multiple app instances
  until rate-limit/recurring state moves to shared storage (Redis).
- No professional pentest yet — schedule one before storing high-value
  customer data at scale.
- Nominatim/OSRM are fair-use free APIs — if routing or geocoding degrades,
  the app degrades gracefully (never crashes), but have a status page note
  ready.

### When to call it "launched"
- [ ] 5+ real businesses onboarded, creating real jobs
- [ ] At least one customer found a provider through the directory
- [ ] Zero data-loss incidents, backups verified twice
- [ ] Then: start the growth loop (directory SEO, WhatsApp sharing)
