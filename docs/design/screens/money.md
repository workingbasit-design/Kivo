# Money — screen brief (Part E4)

## The screen's job
Show the business exactly where its money stands and what to do about it. Three questions, answered at a glance:
1. What work is done but not yet billed? (Ready to invoice)
2. Who owes me money? (Awaiting payment)
3. What's waiting on the customer's decision? (Awaiting a decision)

## Primary action
"New invoice" in the top bar (PageHeader). The screen itself leads with actions per row (Create invoice, Record payment, View quote), not with a single big button.

## What the user must understand within 3 seconds
"I have X jobs to invoice, Y invoices unpaid, Z quotes waiting." Each section shows its items with amounts and one-tap actions. No giant $0.00 numbers — lists of items, not stat cards.

## 390px wireframe

```
┌─────────────────────────────────┐
│ Money                    [+]    │  ← PageHeader, "New invoice" primary
├─────────────────────────────────┤
│ Ready to invoice (2)      $850  │  ← SectionHeader + total
│ ┌─────────────────────────────┐ │
│ │ Fix leaky faucet            │ │
│ │ Farha · Completed Tue       │ │
│ │              $350  [Invoice]│ │  ← ListRow + action button
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Drain cleaning              │ │
│ │ Marc · Completed Wed        │ │
│ │              $500  [Invoice]│ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Awaiting payment (3)    $1,200  │
│ ┌─────────────────────────────┐ │
│ │ INV-0042 · Farha      $400  │ │
│ │ 12 days overdue [Remind][Pay]│ │  ← one urgency signal + actions
│ └─────────────────────────────┘ │
│ ...                             │
├─────────────────────────────────┤
│ Awaiting decision (1)     $600  │
│ ┌─────────────────────────────┐ │
│ │ Q-0015 · Bathroom reno $600 │ │
│ │ Sent 5 days ago [View]      │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
  (tab bar)
```

Empty state (new business): one EmptyState — "Nothing to collect yet. Create your first invoice when a job is done." + "New invoice" action. No $0.00 cards.

## Decisions
- Three sections, always in this order: Ready to invoice → Awaiting payment → Awaiting a decision. Money flows left to right: work → bill → paid.
- "Ready to invoice" = completed jobs with no invoice (existing query, kept).
- "Awaiting payment" = unpaid/partial invoices, oldest first, with days-overdue signal. Overdue reminder queue merged into this section (one urgency signal, not a separate card).
- "Awaiting decision" = SENT quotes. Shows days since sent.
- Each section header shows count + total. Each row shows the item + one-tap action.
- Record payment opens in a BottomSheet (Part C overlays), not a full page.
- Quote/invoice builder: line items as rows edited in sheets, quantity stepper, price book search, live totals in sticky footer, "Preview as customer" + send sheet. (Builder is a larger feature; this brief covers the hub. Builder improvements tracked as follow-up.)
