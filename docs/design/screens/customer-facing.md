# E8: Customer-facing pages — Screen brief

## The pages' job

These are the pages a homeowner sees. They never log in. They arrive from a link
(text, email, QR code) and need to do one thing: trust the business enough to
approve a quote, pay an invoice, or request work.

The four pages:
1. **Public profile** (`/p/[slug]`) — the business's public face. Trust signals.
2. **Quote approval** (`/q/[token]`) — review and approve/decline a quote.
3. **Invoice payment** (`/i/[token]`) — review and pay an invoice.
4. **Customer portal** (`/portal/[token]`) — the customer's own jobs, quotes, invoices.

## Primary actions

| Page | Primary action |
|---|---|
| Public profile | Request a quote (or call/message) |
| Quote approval | Approve quote (or decline) |
| Invoice payment | Pay now |
| Customer portal | View details (no single action; it's a hub) |

## What the customer must understand within 3 seconds

1. **Who is this?** Business name, logo, what they do.
2. **Can I trust them?** Licence, insurance, reviews, verified badge.
3. **What do I need to do?** The one action, clearly labeled with the amount.
4. **What does it cost?** The price, broken down (subtotal, taxes, total). No surprises.

## 390px wireframe descriptions

### Public profile (`/p/[slug]`)

```
┌─────────────────────────┐
│ [Logo] Business name     │  ← header, verified badge
│ Plumber · Toronto        │  ← trade, service area
│ ★★★★★ 4.8 (23 reviews)  │  ← rating summary
├─────────────────────────┤
│ Trust signals            │
│ ✓ Licensed · #12345      │  ← Designation: LICENSE
│ ✓ Insured · $2M liability│  ← Designation: INSURANCE
│ ✓ Red Seal certified     │  ← Designation: RED_SEAL
├─────────────────────────┤
│ Services & prices        │
│ Drain cleaning ... $120  │
│ Faucet install ... $85   │
├─────────────────────────┤
│ Recent reviews           │
│ "Fixed our sink fast..." │
│ ★★★★★ · Marie D.         │
├─────────────────────────┤
│ [Request a quote]        │  ← primary, sticky bottom
│ [Call] [Message]         │  ← secondary actions
└─────────────────────────┘
```

### Quote approval (`/q/[token]`)

```
┌─────────────────────────┐
│ Quote #Q-001             │  ← number, status badge
│ From: Business name      │
│ For: Customer name       │
├─────────────────────────┤
│ Line items               │
│ Drain cleaning ... $120  │
│ Parts ............ $45   │
├─────────────────────────┤
│ Subtotal ........ $165   │  ← tax breakdown
│ GST (5%) ........ $8.25  │
│ QST (9.975%) ... $16.46  │
│ Total .......... $189.71 │  ← bold, large
├─────────────────────────┤
│ [Approve quote]          │  ← primary
│ [Decline]                │  ← secondary (destructive style)
├─────────────────────────┤
│ EN | FR                  │  ← language toggle
└─────────────────────────┘
```

### Invoice payment (`/i/[token]`)

```
┌─────────────────────────┐
│ Invoice #INV-001         │
│ From: Business name      │
│ Due: Mar 15, 2026        │
├─────────────────────────┤
│ Line items               │
│ ...                      │
├─────────────────────────┤
│ Subtotal ........ $165   │
│ GST (5%) ........ $8.25  │
│ Total .......... $189.71 │
│ Paid ............ $0.00  │
│ Balance due .... $189.71 │  ← emphasized
├─────────────────────────┤
│ [Pay $189.71 now]        │  ← primary, amount in label
│ Pay by Interac: ...      │  ← alternative
├─────────────────────────┤
│ EN | FR                  │
└─────────────────────────┘
```

## Design decisions

- **Trust signals are self-declared, never invented.** The `Designation` model
  stores what the business claims (licence #, insurance, Red Seal). We display
  exactly what they entered, with the issuer. We never scrape or fabricate.
- **Tax breakdown on quotes.** The invoice page already shows subtotal + tax.
  The quote page only showed the total. E8 adds the breakdown to quotes too —
  the customer should see the same math the business sees.
- **Language toggle on every public page.** All pages already respect the
  locale, but there was no visible way to switch. The `LanguageToggle`
  component is now on all four pages.
- **No login, no tracking.** These pages set no auth cookies and load only the
  single record the token grants. Rate-limited by IP.
- **Performance.** Server-rendered, no client JS framework needed for the core
  content. Images are optional (logo only). Works on 3G.
