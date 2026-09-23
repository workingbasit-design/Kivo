# Track 9 — Automated Messaging + Online Payments: setup guide

EveryJob's automated messaging and online payments are **opt-in features**.
Messaging only goes to customers with explicit opt-in consent (CASL), respects
quiet hours (21:00–08:00 business timezone), and **hard-stops at the free
quota** — the system cannot silently incur messaging charges. Payments flow
through each business's **own Stripe Connect account**; EveryJob never holds
money, and card data never touches EveryJob servers (Stripe Checkout only).

## 1. Environment variables

Set these in the host's environment / secrets manager (Vercel → Project
Settings → Environment Variables). Never commit values to git.

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. |
| `APP_BASE_URL` | Yes | Public base URL, e.g. `https://kivo-nine-silk.vercel.app`. Used for share links, webhook display, and payment success URLs. |
| `CRON_SECRET` | Yes | Random secret protecting `/api/cron/messaging` (hourly trigger). Generate with `openssl rand -base64 32`. |
| `WHATSAPP_VERIFY_TOKEN` | Yes | Random string you invent; entered both here and in the Meta app dashboard webhook settings. Verifies Meta's webhook subscription. |
| `STRIPE_SECRET_KEY` | Yes | **Platform** Stripe secret key (`sk_test_…` first; `sk_live_…` only after owner sign-off). Used for Connect OAuth and API calls made on behalf of connected accounts. |
| `STRIPE_CLIENT_ID` | Yes | Platform Stripe client ID (`ca_…`) for Connect OAuth. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Signing secret (`whsec_…`) for the Stripe webhook endpoint. Verifies webhook signatures. |
| `MESSAGING_ENC_KEY` | Yes | Base64-encoded 32-byte key used to encrypt per-business WhatsApp tokens and Resend API keys at rest (AES-256-GCM). Generate with `openssl rand -base64 32`. **Losing/rotating this key makes stored provider credentials unreadable** — businesses then re-enter them in Settings → Messaging. |

Copy `.env.example` to `.env` for local development and fill in test-mode values.

## 2. URLs to register

Production base: `https://kivo-nine-silk.vercel.app`

| Purpose | URL |
|---|---|
| WhatsApp webhook (Meta app dashboard → WhatsApp → Configuration → Webhook) | `https://kivo-nine-silk.vercel.app/api/whatsapp/webhook` |
| Stripe Connect OAuth redirect (Stripe Dashboard → Settings → Connect → OAuth settings) | `https://kivo-nine-silk.vercel.app/api/stripe/callback` |
| Stripe webhook (Stripe Dashboard → Developers → Webhooks → Add endpoint) | `https://kivo-nine-silk.vercel.app/api/stripe/webhook` |

### Stripe webhook events to subscribe

- `checkout.session.completed` (records invoice payments and quote deposits, notifies the owner)
- `checkout.session.expired` (marks abandoned checkouts)

### Cron

`vercel.json` already declares the hourly job:

```json
{ "path": "/api/cron/messaging", "schedule": "0 * * * *" }
```

The route requires `Authorization: Bearer <CRON_SECRET>`. Hourly cron jobs
require a Vercel plan that supports them — verify in Vercel Dashboard →
Project → Cron Jobs after deploying; on plans limited to daily crons the
schedule silently degrades (reminders then evaluate once a day).

### Local development

Use the Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

WhatsApp webhook verification can be tested with the `hub.mode` /
`hub.verify_token` / `hub.challenge` GET handshake against
`http://localhost:3000/api/whatsapp/webhook`.

## 3. Per-business setup (done by each business owner in the app)

Credentials are **per business**, entered in the app and **encrypted at rest**
(AES-256-GCM via `MESSAGING_ENC_KEY`). They are never shown back in full,
never logged, and only decrypted in memory at send time.

### WhatsApp (Settings → Messaging → WhatsApp)

1. The business creates a Meta app with WhatsApp Cloud API, gets a
   **phone_number_id** and a **system-user access token**.
2. They paste both into EveryJob; EveryJob verifies with a read-only
   `GET /{phone_number_id}` call before saving.
3. They set the webhook (URL above) in the Meta dashboard using
   `WHATSAPP_VERIFY_TOKEN`, and subscribe to **messages** so customer
   STOP/HELP replies are received.
4. **Free-quota behavior.** Meta delivers free-form text free only inside an
   open 24-hour customer-service window and grants each number 1,000 free
   service messages per calendar month (Meta's published WhatsApp pricing —
   re-verify in the
   [WhatsApp Business Platform pricing docs](https://developers.facebook.com/docs/whatsapp/pricing)
   before relying on it, as Meta changes these terms). Outside the service
   window Meta requires an approved **utility template** (paid). EveryJob
   never sends paid templates: if Meta answers `template_required`, the
   message automatically **falls back to email** instead, and the monthly
   WhatsApp counter hard-stops at 1,000. WhatsApp sending is fail-closed by
   design.

### Email (Settings → Messaging → Email)

1. The business creates a free **Resend** account and API key, verifies its
   sending domain in Resend.
2. They paste the from-address and API key into EveryJob; EveryJob verifies
   with a read-only `GET /domains` call before saving.
3. **Free tier (Resend's published limits —
   [pricing](https://resend.com/pricing),
   [quotas & limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)):
   3,000 emails/month **and** 100 emails/day.** EveryJob enforces **both**
   caps (monthly counter + a business-timezone daily counter) and hard-stops
   at whichever hits first.

### SMS

Disabled by design. No carrier offers a genuine ongoing free SMS tier, so the
SMS provider is a stub that refuses to send rather than risk a charge. There
is nothing to configure.

### Stripe (Settings → Payments)

1. The owner clicks **Connect with Stripe** → Stripe Connect OAuth
   (CSRF-protected: random `HttpOnly` `SameSite` state cookie, 10-minute
   lifetime, single use, fixed local redirects).
2. They complete Stripe onboarding; EveryJob records the connected
   `acct_…`, charges/payouts capability status, and test vs live mode.
3. **Test mode first.** The settings page shows a test/live indicator and a
   banner while in test mode. Live mode requires an **explicit owner
   confirmation** in the UI (recorded as `liveConfirmedAt`); the pay
   endpoints also enforce it server-side. Use Stripe test cards until then.
4. Invoice **Pay now** and quote **deposit** buttons appear on the public
   portals only when Stripe is connected, charges are enabled, and (for live
   accounts) live mode was explicitly confirmed.

## 4. How the automations work

- **Triggers** (all default OFF; owner enables each in Settings → Messaging):
  24-hour appointment reminder, day-of reminder, invoice due, invoice
  overdue, quote follow-up after 7 days, review request after completion.
- **Dry-run defaults ON**: preview first (`Preview & run` shows exactly what
  would send and logs it); flip the switch to send for real.
- **CASL consent**: each customer has an opt-in toggle on their detail page
  (EN/FR). No consent → no automated send, ever. Every opt-in/opt-out and
  every WhatsApp STOP/HELP is written to the tenant-scoped consent log.
- **Quiet hours**: nothing sends 21:00–08:00 in the business timezone;
  deferred messages are logged as deferred.
- **Quota**: monthly WhatsApp and monthly + daily email counters, reserved
  atomically before each provider call (concurrent cron runs can't overshoot).
  When a cap is hit: the send is logged `BLOCKED_QUOTA`, the owner gets one
  in-app notice (not spammed), and nothing further sends until the quota
  resets.
- **Payments**: Stripe webhooks are signature-verified and idempotent
  (each `evt_…` handled once; duplicate deliveries are safe). Successful
  checkout records the payment/deposit, receipt URL, and notifies the owner.
  Interac e-Transfer / cash / cheque remain record-only flows. Online Interac
  is **not** offered (no officially verified support).

## 5. Verification checklist

- [ ] `npx tsc --noEmit` — clean
- [ ] `npm test` — all pass, zero live provider calls (tests inject mock `fetch`)
- [ ] `npm run build` — clean
- [ ] Connect WhatsApp in staging, run a **preview** cycle, confirm logs show DRY_RUN and nothing is delivered
- [ ] Flip to live, confirm a reminder delivers inside the WhatsApp 24h window
- [ ] Reply STOP to the WhatsApp number, confirm consent flips off and is logged
- [ ] Connect Stripe in **test** mode, pay a test invoice with `4242 4242 4242 4242`, confirm the webhook marks it paid and records the receipt
- [ ] Exhaust the Resend daily cap in staging, confirm hard stop + owner notice
- [ ] Confirm live-mode confirmation gate blocks live charges until explicitly confirmed
