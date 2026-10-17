# E1: Today (dashboard) — Screen Brief

**Status:** Part E1. Written 2026-10-17.

## The screen's job

Show the tradesperson what needs doing right now, in the order they'd act on it. The app's main job is "show what needs doing next, and get the business paid" (DESIGN.md §1). The Today screen is where that promise lives or dies.

## Primary action

"New job" — the single primary action in the PageHeader (Part D established this). One per screen, always in the same place.

## What the user must understand within 3 seconds

1. **Is anything on fire?** Late jobs, overdue invoices, quotes waiting — the attention items.
2. **What's happening today?** The agenda: who, when, where.
3. **Am I getting paid?** Money in, money owed — compact, truthful.

If the answer to all three is "nothing," the screen says so calmly and points to the one thing that moves the business forward (create the first job).

## 390px wireframe

```
┌─────────────────────────────────┐
│ Today                    [+ New] │  ← PageHeader: title + date
│ Saturday, October 17            │  ← Date line (long format)
├─────────────────────────────────┤
│ ⚠ NEEDS YOU (3)                 │  ← Attention: only if items exist
│ ┌─────────────────────────────┐ │
│ │ ⚠ Home cleaning             │ │
│ │   3 days late · Farha       │ │
│ │   [Start] [Reschedule]      │ │  ← One-tap actions
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ⚠ Invoice INV-0004          │ │
│ │   $450 overdue · 5 days     │ │
│ │   [Send reminder] [View]    │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ TODAY'S AGENDA                  │
│ ┌─────────────────────────────┐ │
│ │ 10:00  Plumbing repair      │ │
│ │        Martin Roy · Confirmed│ │
│ ├─────────────────────────────┤ │
│ │ 14:30  Fan install          │ │
│ │        Sarah Tremblay · New  │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ MONEY                           │  ← Compact rows, only with data
│ Collected last 7 days    $1,240 │
│ Outstanding (3 invoices)   $890 │
│ Ready to invoice (2)       $650 │
├─────────────────────────────────┤
│ GET SET UP (2 of 3)             │  ← Checklist last, until done
│ ○ Add your first customer  [Add] │
│ ✓ Create your first job         │
│ ○ Send your first quote   [New] │
│ [Do later]                      │
└─────────────────────────────────┘
│ [Tab bar: Today Schedule Jobs   │
│  Money More]                    │
└─────────────────────────────────┘
```

**New business variant** (no jobs, no invoices, no customers):
```
┌─────────────────────────────────┐
│ Today                    [+ New] │
│ Saturday, October 17            │
├─────────────────────────────────┤
│ GET SET UP (0 of 3)             │  ← Checklist replaces $0 cards
│ ○ Add your first customer  [Add] │
│ ○ Create your first job   [New] │  ← One clear action
│ ○ Send your first quote   [New] │
│ [Do later]                      │
├─────────────────────────────────┤
│ (No attention items — calm)     │
│ (No agenda — "Nothing scheduled │
│  today" only after first job)   │
│ (No money section — no data)    │
└─────────────────────────────────┘
```

## Design decisions

1. **Attention first, not stats.** The old screen led with four $0.00 cards and buried three late jobs below. The new order is: needs you → today's agenda → money → checklist. What's next before what's there (DESIGN.md §2).

2. **Money as rows, not cards.** The four stat cards become a compact "Money" section with one row per metric. Each row shows only if it has data or matters. No $0.00 cards for a new business — they say nothing and imply failure.

3. **Checklist last (until done).** For a new business, the checklist IS the screen — it replaces the empty stats. Once done, it disappears entirely (Part A Item 1).

4. **One-tap actions on attention items.** Each attention row gets contextual actions (Start/Reschedule for late jobs, Send reminder/View for overdue invoices). This was deferred from Part A Item 7; E1 implements it.

5. **Date line: "Saturday, October 17".** Long weekday, long month, day. No year (it's this year). No greeting — Part A found no greeting was rendered, and a wrong greeting is worse than none.

6. **No duplicate CTAs.** The PageHeader "New job" is the single primary. Empty states point to it; they don't duplicate it (Part D rule).

## What changed from the old screen

| Old | New |
|---|---|
| 4 stat cards ($0.00) at top | Attention items first |
| Attention buried below stats | Attention is section 1 |
| "Today's schedule" + "Payments due" as cards | "Today's agenda" as list; payments in Money section |
| "Ready to invoice" as separate card | Row in Money section |
| "Upcoming jobs" + "Quick actions" cards | Upcoming in agenda; quick actions removed (use tab bar) |
| Checklist at top | Checklist last (or only, for new business) |
| Date: "Sat, Oct 17, 2026" | Date: "Saturday, October 17" |
| Two "New job" buttons | One in PageHeader |

## Open questions

1. Should "Quick actions" (New customer/quote/invoice) move to a long-press on the + button, or stay in More?
2. The "Jobs by status" chips — keep on Today, or move to Jobs screen only?
