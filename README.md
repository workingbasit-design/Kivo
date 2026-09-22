# Kivo — Every job. One place.

Kivo is a free, full-stack field-service management app for service businesses
(think "Jobber of India"): customers, leads, jobs & scheduling, quotes,
invoices with India/Canada tax support, payments, reviews, timesheets, team
management, recurring jobs, route optimization, marketing drafts, an AI
copilot (Hinglish-friendly), public booking pages, and a public **Kivo
Directory** where customers can discover providers and request quotes.

V1 is genuinely free: no billing, no ads, no commissions, no locked features.
Kivo never processes money and never auto-sends messages — WhatsApp and
reminders are always user-initiated.

## Run it locally

Requirements: Node.js 18+ and npm.

```bash
git clone <your-repo-url>
cd kivo
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open **http://localhost:3100** in your browser.

Register a new business account on the sign-up page and explore:
dashboard, customers, jobs, quotes → invoices → payments, schedule,
recurring jobs, routes, marketing, timesheets, team, settings, and the
public directory at `/directory`.

Optional AI upgrade: set `ANTHROPIC_API_KEY` in a `.env` file to use
Claude in the AI copilot. Without it, the built-in rule-based assistant
handles everything.

```bash
# .env (optional)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

## Production

See [DEPLOY.md](./DEPLOY.md) for hosting options (Vercel / Railway /
Fly.io / VPS), the SQLite → Postgres migration, environment variables,
backups, and rollback. See [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)
for the go-live checklist.

## Docs in this repo

- `DEPLOY.md` — deployment guide
- `LAUNCH_CHECKLIST.md` — launch checklist
- `RELEASE_NOTES.md` — release notes
- `TEST_REPORT.md` — full QA report (79/79 release pass, 39/39 directory, 15/15 final verification)
- `DIR_NOTES.md` — Kivo Directory build notes
