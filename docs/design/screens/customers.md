# Screen brief: Customers and leads (E5)

## The screen's job

**Customer detail:** answer "who is this person, how do I reach them, and what have we done for them" in one glance. A tradesperson standing in a driveway needs the phone number and address instantly, not after scrolling.

**Leads:** triage new inquiries fast. Accept the good ones (turn them into customers), decline the bad ones with a reason so the business learns what work to avoid.

## Primary action

- Customer detail: **New job** for this customer (the most common next step after finding a customer).
- Leads: **Accept** (convert to customer) or **Decline with reason** per lead.

## What the user must understand within 3 seconds

- Customer detail: name, how to contact them (call/text/email/map), and whether they owe money or have upcoming work.
- Leads: how many new leads need a decision, and what each one wants.

## 390px wireframe

### Customer detail

```
┌─────────────────────────────┐
│ < Customers      [+ New job]│  PageHeader, one primary action
├─────────────────────────────┤
│ (AB) Alex Bernard           │  Avatar + name + "Customer since..."
├─────────────────────────────┤
│ [Call] [Text] [Email] [Map] │  4 large action buttons, 44px+
├─────────────────────────────┤
│ Address                     │
│ 123 Main St, Toronto ON     │  With "Get directions" link
│ Notes...                    │
├─────────────────────────────┤
│ History                     │  Part C Timeline
│ ● Job completed  Tue, Sep 29│  jobs + invoices + reviews,
│ ● Invoice paid   Mon, Sep 21│  newest first
│ ● Quote sent     Fri, Sep 12│
├─────────────────────────────┤
│ Properties                  │  Existing component
│ ● Home (primary)            │
│   123 Main St...            │
├─────────────────────────────┤
│ [Edit] [Archive] [Delete]   │  Secondary/destructive, bottom
└─────────────────────────────┘
```

### Leads

```
┌─────────────────────────────┐
│ Leads              [+ Add]  │
├─────────────────────────────┤
│ [New 2] [Contacted 1]       │  Filter chips, not a kanban
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Sam Lee            NEW  │ │
│ │ Furnace quote...        │ │
│ │ (416) 555-0100          │ │
│ │ [Accept] [Decline]      │ │  One-tap triage
│ └─────────────────────────┘ │
└─────────────────────────────┘

Decline opens a sheet:
┌─────────────────────────────┐
│ Decline lead                │
│ Why are you declining?      │
│ ○ Too far                   │
│ ○ Wrong type of work        │
│ ○ Price too low             │
│ ○ Already booked            │
│ ○ Other                     │
│ Notes (optional)            │
│ [_______]                   │
│ [Decline lead] [Cancel]     │
└─────────────────────────────┘
```

## Decisions

- Replaced the three-column kanban with a single filterable list. Kanban wastes horizontal space on phones and the drag interaction has no keyboard equivalent. Filter chips (Part C) do the same job.
- The decline reason is stored on the lead (`declineReason` column, migration m24) and shown on declined leads, so the business can spot patterns (e.g. "too far" means the service area needs adjusting).
- Contact actions use native protocols: `tel:`, `sms:`, `mailto:`, Google Maps link. No in-app messaging. WhatsApp stays as a secondary option (existing button kept).
- History merges jobs, invoices, and reviews into one Part C Timeline, newest first, instead of three separate cards. One scroll, one story.
- Properties section kept as-is (existing `CustomerProperties` component already does add/remove/primary).
- Consent card, portal link, custom fields, and equipment sections kept below the fold. They matter for compliance but are not the 3-second job.
- Copy follows VOICE.md: "Customer since Sep 2024", no middle dots, no "No jobs yet!" with exclamation.
