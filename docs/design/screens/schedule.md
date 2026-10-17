# Schedule — screen brief (Part E2)

## The screen's job

Show when each visit happens this week, flag visits that collide, and let the
owner move a visit to another day. This is the "where do I need to be" screen.

## Primary action

"Schedule new job" (PageHeader). One primary action per screen (Part D rule).

## What the user must understand within 3 seconds

1. Which days this week have work (count badges on the strip).
2. Which day is today (business timezone, not the phone's).
3. What's on for the selected day, in time order.

## 390px wireframe

```
┌─────────────────────────────────────┐
│ Schedule              [+ Schedule   │
│ Jun 8 - Jun 14 2026    new job]     │
├─────────────────────────────────────┤
│ ⚠ Late jobs (2)                  >  │  ← Banner, only when late jobs exist
│   Two jobs passed their date...     │     (icon + word, never colour alone)
├─────────────────────────────────────┤
│ <  [This week]  Jun 8 - Jun 14  >   │
│ ┌──┬──┬──┬──┬──┬──┬──┐               │
│ │M │Tu│W │Th│F │S │Su│               │
│ │ 8│ 9│10│11│12│13│14│  ← today: dot
│ │ 2│  │ 3│  │ 1│  │  │     + bold    │
│ └──┴──┴──┴──┴──┴──┴──┘               │
├─────────────────────────────────────┤
│ ⚠ Overlapping visits                │  ← conflict Banner, only when needed
│   Furnace repair and Tap fix both   │
│   start at 10:00 AM on Tue, Jun 9.  │
├─────────────────────────────────────┤
│ Tuesday, June 9 · 3 visits          │
│ ────────────────────────────────    │
│ ⠿ 10:00 AM  Furnace repair    ⋮    │  ← drag handle (desktop only)
│    Farha · 123 Main St              │
│    [Scheduled ▾] [✎] [🗑]           │
│ ────────────────────────────────    │
│ ⠿ 10:00 AM  Tap fix          ⋮     │
│    ...                              │
├─────────────────────────────────────┤
│ [All][Scheduled][In progress]...    │  ← FilterChip row (status)
│ [🔍 Search schedule]                │
└─────────────────────────────────────┘
```

## Decisions

- **Today marker:** a dot + bold date number, not lime. DESIGN.md gives lime
  exactly two jobs (dark-surface primary, active tab). "Today" is a status,
  shown with a shape, and named in the day cell's aria-label.
- **Selected day:** filled ink cell (existing pattern, kept).
- **Conflicts:** same start time on the same day, both visits open and timed.
  No invented durations. The banner names both visits, the time, and the day.
- **Drag and drop:** HTML5 DnD on desktop (pointer: fine) via a grip handle.
  The reschedule dialog (date picker) is the non-drag path and the only path
  on touch/keyboard (WCAG 2.5.7).
- **Week strip is a client component** (`WeekStrip.tsx`) so day cells can be
  drop targets while keeping Link navigation (deep-linkable days, back button
  works).

## Deferred

- Time-grid (calendar) view. The agenda list is the mobile-first pattern and
  carries all the information; a grid is a larger feature.
- Touch drag-and-drop. HTML5 DnD does not work on touch; the reschedule
  dialog covers touch and keyboard.
