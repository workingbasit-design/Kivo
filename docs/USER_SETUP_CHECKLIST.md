# EveryJob — User Setup Checklist

Everything a business owner (or the person deploying EveryJob) needs to
configure so every integration works. The app degrades gracefully when an
integration is not configured — each section names exactly what to do to
turn it on.

App: EveryJob · Canada-only · CAD · EN / fr-CA
Production URL (current): https://kivo-nine-silk.vercel.app

---

## 1. Platform environment variables

Set these on the host (Vercel → Project Settings → Environment Variables).
Never commit real values. Generate secrets with `openssl rand -base64 32`.

| Variable | Required? | What it enables |
|---|---|---|
| `DATABASE_URL` | **Yes** | Postgres (production) or file path (local dev SQLite). Build runs `prisma generate && prisma db push --skip-generate && next build`. |
| `APP_BASE_URL` | **Yes** | Public base URL, e.g. `https://kivo-nine-silk.vercel.app`. Used for quote/invoice/booking/signing share links and Stripe success URLs. |
| `CRON_SECRET` | **Yes** | Protects the three cron routes. Vercel cron calls them automatically (see `vercel.json`); manual calls need `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Google sign-in **and** Google Business Profile review sync. Without them, the app shows a plain-language setup checklist instead of broken buttons. |
| `STRIPE_SECRET_KEY` | Optional | Card payments via Stripe Connect. Start with `sk_test_…`; go live only after explicit owner confirmation. |
| `STRIPE_CLIENT_ID` | Optional | Stripe Connect OAuth client id (`ca_…`) for onboarding businesses. |
| `STRIPE_WEBHOOK_SECRET` | Optional | Verifies `POST /api/stripe/webhook` signatures. Required if `STRIPE_SECRET_KEY` is set. |
| `WHATSAPP_VERIFY_TOKEN` | Optional | Verifies the Meta webhook handshake for inbound WhatsApp (STOP/HELP keywords). |
| `MESSAGING_ENC_KEY` | Optional | 32-byte base64 key encrypting per-business WhatsApp tokens and Resend API keys at rest. **Required** if any business connects WhatsApp or email. |
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob token for job/customer attachments. Without it, the attachments UI explains how to enable it. |
| `ANTHROPIC_API_KEY` | Optional | Claude-powered copilot replies. Without it, the built-in rule-based copilot (fully tested) is used. |
| `ANTHROPIC_MODEL` | Optional | Model override for the above. |
| `KIVO_ADMIN_EMAILS` | Optional | Comma-separated admin emails for the `/directory-reports` moderation queue. |
| `NODE_ENV` | **Yes** | Set to `production` on the host. |

---

## 2. Provider accounts to create

- **Google Cloud project** — OAuth 2.0 client (Web application). Needed only for
  Google sign-in and/or Google Business Profile reviews.
- **Stripe account (platform)** — developer dashboard for API keys, Connect
  settings, and webhooks. Test mode first.
- **Meta app (WhatsApp Cloud API)** — only if sending/receiving WhatsApp
  business messages. Each business then connects its own number from
  EveryJob → Settings → Messaging (tokens are encrypted per business).
- **Resend account** — only if sending email from EveryJob. Each business
  pastes its own API key in Settings → Messaging (encrypted at rest).
- **Vercel Blob store** — only for attachments.

No other accounts are needed. The directory, booking pages, portals, and
e-signing work with just `DATABASE_URL` + `APP_BASE_URL`.

---

## 3. Redirect URIs to register

### Google OAuth (Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs)

Register **both**:

1. `https://<your-domain>/api/auth/google/callback` — Google sign-in
2. `https://<your-domain>/api/google/callback` — Google Business Profile connect

(For local dev, the same paths on `http://localhost:3000`.)

### Stripe Connect (Stripe Dashboard → Settings → Connect → OAuth settings)

- Redirect URI: `https://<your-domain>/api/stripe/callback`

---

## 4. Webhook URIs to register

### Stripe (Stripe Dashboard → Developers → Webhooks → Add endpoint)

- URL: `https://<your-domain>/api/stripe/webhook`
- Events to send:
  - `checkout.session.completed`
  - `checkout.session.expired`
- Signing secret → `STRIPE_WEBHOOK_SECRET`
- Notes: handlers are idempotent (each Stripe event id is processed once;
  duplicate deliveries are acknowledged, not double-recorded). Connect
  destination charges go **directly to the business's Stripe account** —
  EveryJob never holds funds or card data.

### WhatsApp / Meta (Meta app dashboard → WhatsApp → Configuration → Webhook)

- Callback URL: `https://<your-domain>/api/whatsapp/webhook`
- Verify token: the value of `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the `messages` field. Inbound STOP/HELP keywords update
  consent automatically (CASL-compliant).

---

## 5. Cron jobs

Declared in `vercel.json` (Vercel Cron runs them automatically):

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/messaging` | hourly (`0 * * * *`) | Sends due automated messages (reminders, review requests); enforces consent, quiet hours, business toggles, and free-quota hard stops |
| `/api/cron/recurring` | daily 06:00 UTC | Generates jobs from recurring plans |
| `/api/cron/workflows` | daily 06:30 UTC | Fires workflow automation rules |

All three require `CRON_SECRET` (Bearer token or `?secret=` query param).

---

## 6. Per-business setup (inside the app, no code)

Each business, under **Settings**:

1. **Business profile** — name, phone, timezone (defaults to America/Toronto),
   currency (CAD), working hours.
2. **Booking page** — enable at Settings → Online booking, share the public link.
3. **Messaging** — connect WhatsApp (own number + token) and/or Resend (own API
   key); toggle which message types are allowed; review consent log and quota.
4. **Payments** — connect Stripe (Connect onboarding); money goes straight to
   the business's Stripe account.
5. **Google reviews** — connect Google Business Profile, pick a location, sync.
6. **Team** — invite members; assign technicians to jobs for utilization insights.

---

## 7. Graceful degradation (what happens when something is NOT set up)

- **Google sign-in / Business Profile**: plain-language setup checklist with the
  exact callback URLs; no dead buttons.
- **Stripe**: payments settings show a "not configured" notice; Connect link is
  contextual, never a broken payment button.
- **Attachments**: upload UI explains the missing `BLOB_READ_WRITE_TOKEN`.
- **WhatsApp / Resend**: messaging settings show per-channel setup steps;
  sends are blocked with a clear reason when unconfigured.
- **Messaging encryption key**: connecting a provider without
  `MESSAGING_ENC_KEY` is refused with instructions, never silent failure.
- **Copilot AI**: falls back to the built-in rule engine.

---

## 8. Pre-launch verification commands

```bash
npx prisma generate        # regenerate client (never rely on a stale one)
npx tsc --noEmit           # typecheck clean
npm test                   # full suite incl. regression tests
npm run build              # production build
git status                 # must be clean
```

Do **not** push without the owner's explicit release approval.
