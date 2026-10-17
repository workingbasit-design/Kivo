# E3: Jobs — Screen Brief

**Status:** Part E3. Written 2026-10-17.

## The screen's job

Let the tradesperson find any job fast, see its status at a glance, and act on it. Jobs are the core of the business — every dollar flows through a job. The list must answer "what's the state of my work" in one scan; the detail must answer "what do I do next" with one obvious action.

## Primary action

**List:** "New job" in the PageHeader (Part D rule — one per screen, always in the same place).
**Detail:** A sticky primary action that matches the job's status: Start job → Complete → Invoice. The action changes as the job moves forward; there is never more than one.

## What the user must understand within 3 seconds

**List:**
1. How many jobs, and how they're split (filter chips with counts).
2. Each row: what (title), who (customer), when (date), how it's going (status badge), how much (amount).
3. Late jobs are visually distinct — one urgency signal, not two.

**Detail:**
1. What state the job is in (status badge + timeline).
2. What to do next (the sticky primary action).
3. Where and when (date, time, address with map link).

## 390px wireframe

**List:**
```
┌─────────────────────────────────┐
│ Jobs                     [+ New] │  ← PageHeader
│ 12 jobs                         │  ← Count subtitle
├─────────────────────────────────┤
│ [Search jobs, customers...]     │  ← SearchField
├─────────────────────────────────┤
│ [All 12][New 3][Scheduled 5]... │  ← FilterChip row (scrollable)
│ [Sort: Date ▾]                  │  ← Sort control
├─────────────────────────────────┤
│ Home cleaning                   │
│ Farha · Tue, Sep 29 · $150   [⋮]│  ← ListRow: title, customer,
│ ⚠ Late                          │     date, amount, status, menu
├─────────────────────────────────┤
│ Plumbing repair                 │
│ Martin Roy · Today · $280    [⋮]│
│ ● In progress                   │
├─────────────────────────────────┤
│ Fan install                     │
│ Sarah T. · Tomorrow · $95    [⋮]│
│ ○ Scheduled                     │
└─────────────────────────────────┘
│ [Tab bar]                       │
└─────────────────────────────────┘
```

**Detail:**
```
┌─────────────────────────────────┐
│ ← Jobs                          │  ← Back with previous screen name
│ Home cleaning                   │  ← Title
│ ⚠ Late · Farha                  │  ← Status + customer
├─────────────────────────────────┤
│ ● Created — Sep 20              │  ← Timeline (status history)
│ ● Scheduled — Tue, Sep 29       │
│ ○ Started (pending)             │
│ ○ Completed (pending)           │
├─────────────────────────────────┤
│ WHEN                            │  ← Collapsible sections
│ Tue, Sep 29 · 10:00 AM          │
│ [Get directions]                │  ← Map link
├─────────────────────────────────┤
│ CUSTOMER                        │
│ Farha · (555) 123-4567          │
│ [Call] [Text]                   │
├─────────────────────────────────┤
│ NOTES (3)                       │  ← Collapsed by default
├─────────────────────────────────┤
│ COSTS                           │  ← Collapsed by default
│ Quoted $150 · Spent $45         │
├─────────────────────────────────┤
│ [━━━━━━ Start job ━━━━━━]       │  ← Sticky primary action
└─────────────────────────────────┘
│ [Tab bar]                       │
└─────────────────────────────────┘
```

## Design decisions

1. **List rows use the Part C ListRow.** Title, customer + date as subtitle, amount as trailing, status badge inline, menu button for swipe-action alternatives. 56px minimum height.

2. **One date style.** All dates use Part A's `formatDisplayDate`: "Today", "Tomorrow", "Tue, Sep 29". Never ISO. Never bare "Sep 29" without the weekday for upcoming jobs.

3. **Sort is new.** The old list had filter chips and search but no sort. Added: Date (nearest first), Amount (high to low), Customer (A-Z). Defaults to Date.

4. **Swipe actions get a menu.** Mobile swipe is undiscoverable; every swipe action (Start, Complete, Delete) also appears in the row's [⋮] menu. (WCAG 2.5.7: non-pointer alternative.)

5. **Detail: timeline first.** The job's status history is the first thing after the header — it answers "where is this job" instantly. Uses Part C Timeline.

6. **Detail: sticky primary action.** The action bar sticks to the bottom (above the tab bar). It shows exactly one action matching the status: "Start job" (scheduled) → "Mark complete" (in progress) → "Create invoice" (completed). Secondary actions (Edit, Delete) move to a menu.

7. **Detail: sections collapse.** Details, Notes, Costs, Time, Photos are collapsible. Open by default: When/Where and Customer. Everything else collapsed to reduce scroll.

8. **Map link.** The address gets a "Get directions" link (Google Maps URL). The old screen showed the address as plain text.

## What changed from the old screen

**List:**
| Old | New |
|---|---|
| Custom row markup | Part C ListRow |
| No sort | Sort control (Date/Amount/Customer) |
| No row actions | [⋮] menu with Start/Complete/Delete |
| `DateTimeText` "short" variant | `formatDisplayDate` (Today/Tomorrow/weekday) |
| Raw Tailwind colors | ej-* tokens |

**Detail:**
| Old | New |
|---|---|
| Status in a Card with buttons | Timeline + sticky primary action |
| All sections expanded | Collapsible sections |
| Address as plain text | "Get directions" map link |
| Edit/Delete as header buttons | Edit in header; Delete in menu |

## Open questions

1. Should the sticky action bar also show the job amount (e.g., "Start job · $150")?
2. For completed jobs, should "Create invoice" be the primary, or "Request review"?
