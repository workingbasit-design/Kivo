# Projects — screen brief (Part E6)

## The screen's job
Group related jobs into ordered phases so a multi-visit job (renovation, build) has one shared structure for the office and the field. Two views: the list (which projects are active) and the detail (how this project is doing).

## Primary action
- New project page: "Create project".
- Detail page: per-phase status advance (To do → In progress → Done).

## What the user must understand within 3 seconds
1. How far along this project is (phases done vs total, with a progress bar).
2. The money: what the customer pays (contract price), what has been invoiced, what has been paid, what is still owed.
3. What the next phase is.

## 390px wireframe (detail)

```
< All projects
[Project title]                    [Status badge]
Customer name · Started Sep 29

Money
  Contract price ......... $24,500.00
  Invoiced ................ $12,000.00
  Paid ..................... $8,000.00
  Remaining ................ $4,000.00

Progress: 2 of 5 phases done
[████████░░░░░░░░]

Phase 1 · Demolition ✓ Done
  3 jobs · $6,200.00
Phase 2 · Rough-in → In progress
  2 jobs · $5,800.00        [Mark done]
Phase 3 · Drywall
  No jobs attached yet      [Start]
[+ Add phase]
```

## New project form wireframe

```
Project name [________]
Description (optional) [________]
Customer (optional) [Select ▾]  New customer →
Contract price (what the customer pays) [$ ____.__]
Start date [____]  End date [____]
Phases (optional)
  Start from a template: [Bathroom reno] [Kitchen reno] [General]
  1 [Demolition        ] [↑] [↓] [×]
  2 [Rough-in          ] [↑] [↓] [×]
  [+ Add phase]
[Create project]
```

## Decisions
- Phases are an ordered list, not a textarea: each phase is a row with up/down/remove, plus trade templates. Order is preserved via the `order` column.
- "Remaining" means invoiced minus paid (money the customer still owes). A second row "Left to invoice" (contract price minus invoiced) shows only when a contract price is set.
- MoneyInput from the Part C library: $ prefix, decimal keyboard, tabular figures. Value stays a dollar string; conversion to cents happens at submit.
- Customer picker stays a native select with "No customer" and a "New customer" link (Part A fix). A searchable picker is a Part C follow-up.
