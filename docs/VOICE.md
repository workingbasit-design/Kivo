# EveryJob Voice Guide

**Status:** Part G (words). Written 2026-10-17.

How EveryJob talks. Plain, calm, specific, respectful of the trade. The reader is a plumber on a roof in February, reading on a phone with gloves on. Every word earns its place.

## Voice

- **Plain.** Short words. Short sentences. No jargon, no marketing fog.
- **Calm.** The app is a tool, not a cheerleader. Periods, not exclamation marks.
- **Specific.** Name the thing and the number. "Invoice INV-0003" beats "your invoice."
- **Respectful of the trade.** The user does real work. We do not talk down, crack jokes about their business, or waste their time.

## Tone by situation

### Errors

Say what happened and what to do. No apology, no jokes, no "Oops."

- Bad: "Oops! Something went wrong!"
- Good: "Could not save the job. Check your connection and try again."

Structure: **what happened** (one clause), then **what to do** (one clause). If there is nothing the user can do, say so: "The server is down. Your work is saved on this device and will sync when the connection returns."

### Success messages

Confirm the exact thing that was done. Name the record and the person.

- Bad: "Done!"
- Good: "Invoice sent to Farha."
- Bad: "Payment recorded successfully!"
- Good: "Payment of $240.00 recorded on INV-0003."

### Empty states

Say what goes here and offer one action.

- Bad: "Nothing here yet!"
- Good: "No jobs scheduled. Create your first job to get started." (with a "New job" button)

### Confirmations (destructive)

Name the exact thing being destroyed and what happens after.

- Bad: "Are you sure?"
- Good: "Delete job 'Furnace repair'? This cannot be undone. Its visits and notes will also be deleted."

## Banned

| Banned | Use instead |
|---|---|
| Exclamation marks | Periods |
| "Oops", "Whoops", "Uh oh" | Plain statement of what happened |
| Jokes in errors | Nothing. Just the facts. |
| Unmeasured claims ("in under 20 seconds", "the fastest", "best") | Measured facts or nothing |
| Em dashes (—), en dashes (–) | Commas, periods, or parentheses |
| Spaced hyphens as dashes ("x - y") | Commas, periods, parentheses, or "to" for ranges |
| Middle dots (·) in labels | Commas or plain words |
| ALL-CAPS labels | Sentence case |
| Arrows appended to links ("View all →") | Plain "View all" |

**Sentence case everywhere.** "New job", not "New Job". "Mark complete", not "Mark Complete".

## Terminology glossary

One word per concept, in both languages. Never swap synonyms mid-app.

| English (en-CA) | Français (fr-CA) | Notes |
|---|---|---|
| job | tâche | A unit of work for a customer. Not "work order", not "gig". |
| visit | visite | One scheduled trip for a job. Not "appointment". |
| quote | soumission | A price offered to a customer. Not "estimate" (an estimate is informal; a quote is the document). |
| invoice | facture | A bill sent to a customer. Always "invoice"/"facture", never "bill". |
| customer | client | The person or business paying. Not "client" in English (we picked "customer"; stick to it). |
| lead | prospect | A potential customer who has not booked yet. |
| late | en retard | Past the scheduled date. "3 days late" / "en retard de 3 jours". |
| overdue | en souffrance | An unpaid invoice past its due date. Invoices are "overdue"; jobs are "late". |
| deposit | acompte | Money paid upfront. Not "down payment". |
| price book | catalogue de prix | The list of standard services and prices. |
| business | entreprise | The user's own company. |
| crew | équipe | The people doing the work. |

## Numbers, dates, times, currency

### Canadian English (en-CA)

- **Currency:** `$1,234.56` — dollar sign, thousands comma, two decimals. Cents always shown in money contexts (`$240.00`, not `$240`). Use `CAD` only where the currency could be ambiguous.
- **Dates:** "Today", "Yesterday", "Tomorrow" where they apply. Otherwise "Tue, Sep 29" within the current year, "Tue, Sep 29, 2025" outside it. Never ISO (`2026-09-29`) to users.
- **Lateness:** "3 days late", "2 weeks overdue". The number is the point; lead with it.
- **Times:** 12-hour with a.m./p.m. ("2:30 p.m."). Business context, not 24-hour.
- **Phone:** `(514) 555-0123`.

### Quebec French (fr-CA)

- **Currency:** `1 234,56 $` — non-breaking space for thousands, comma decimal, dollar sign after with a space. (`240,00 $`, not `240.00$`.)
- **Dates:** "Aujourd'hui", "Hier", "Demain". Otherwise "mar. 29 sept." within the year ("mar., 29 sept. 2025" outside). Weekday abbreviated with a period in running text; the full form ("mardi 29 septembre") is fine in headings.
- **Lateness:** "en retard de 3 jours", "en souffrance depuis 2 semaines".
- **Times:** 24-hour is normal in Quebec ("14 h 30"). Use "14 h 30" (with "h", non-breaking spaces).
- **Phone:** `(514) 555-0123` (same as English).

### Rules for both

- Money uses tabular figures so columns align.
- Never mix formats on the same screen.
- French runs ~15% longer than English. If a string is tight in English, it will overflow in French. Shorten the English.
- The `tu`/`vous` question: EveryJob uses **vous** for the pro (respectful, professional) in user-facing copy. Marketing pages may use tu; the app does not.

## Writing checklist (for every new string)

1. Is it sentence case?
2. Does it name the exact thing (record, person, amount)?
3. Is there exactly one action offered?
4. Any banned characters? (Run `node scripts/check-copy-lint.mjs`.)
5. Read it in French. Does it still fit?
6. Would a roofer in gloves understand it in two seconds?
