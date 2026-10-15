# MANUAL_QA.md — 45–60 minute real-phone checklist

**What:** Things automation cannot check. Run on a real iPhone AND a real Android phone.
**Where:** https://kivo-nine-silk.vercel.app (production). Use a TEST business — prefix everything `QATEST`.
**When:** After every release, before announcing.

## Setup (5 min)

- [ ] iPhone: open the production URL in Safari. Log in with your owner account.
- [ ] Android: open the production URL in Chrome. Log in with your owner account.
- [ ] Confirm you see the dashboard (not a preview deployment URL).

## Camera & receipts (8 min)

- [ ] iPhone: Expenses → New → take a photo of a receipt with the camera. It uploads and shows a thumbnail.
- [ ] Android: same. The receipt viewer opens the photo full-screen; removing it works.
- [ ] Take a photo in poor light — the app accepts it without crashing.

## Real email & SMS (10 min)

- [ ] Send a quote to your own email → the email arrives within 2 minutes, in the right language, with correct totals.
- [ ] Send an invoice to your own email → arrives, totals match the app.
- [ ] Open a client portal link from the email on your phone → it loads without login.
- [ ] If SMS is configured: request a quote from the directory as a customer → the business gets the notification.

## Paying on a phone (8 min)

- [ ] Open a client portal invoice link → Pay with test card `4242 4242 4242 4242` → success, receipt shows.
- [ ] Pay with `4000 0000 0000 0002` → declined gracefully (no crash, clear message).
- [ ] The invoice status flips to Paid in the business app after payment.

## One-handed use & readability (10 min)

- [ ] iPhone: hold the phone in one hand. Reach the tab bar, create a job, and record a payment using only your thumb.
- [ ] Go outside (or max brightness): dashboard numbers, job titles, and money amounts are readable in sunlight.
- [ ] Rotate to landscape on the Jobs list — nothing overlaps or clips.
- [ ] Text size: enable the largest system font — no clipped buttons.

## French mode (5 min)

- [ ] Switch to Français → walk Dashboard, Jobs, Invoices. No English visible.
- [ ] Dates show as `14 oct. 2026`, money as `1 234,56 $`.

## Slow mobile data (5 min)

- [ ] iPhone: Settings → Developer → Network Link Conditioner → Very Bad Network (or Android: Chrome DevTools throttling via `chrome://inspect`).
- [ ] Load the dashboard → a clear loading/error state appears (not a blank screen).
- [ ] Tap Save twice on a new job → exactly ONE job is created.

## Voice (4 min)

- [ ] Open /voice → tap the mic → speak a command → the action runs and the page refreshes.
- [ ] Deny the mic permission → a clear message explains how to re-enable it (no hang on "Listening...").

## Sign-off

- [ ] All boxes checked on BOTH phones. Any failure → file it in `docs/BUGS.md` with phone model + OS version + screenshot.
