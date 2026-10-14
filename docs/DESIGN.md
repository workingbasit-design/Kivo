# EveryJob Design System (DESIGN.md)

## Design principle

Built for a phone held in one hand, often in a work glove, often in bright sunlight, between jobs.

That means:
- **High contrast.** Dark text on light backgrounds. No grey-on-grey. No washed-out icons.
- **Large numerals.** Money and times are the most important numbers on screen. They are big and tabular.
- **48px primary tap targets.** Every primary action is at least 48px tall. Secondary actions at least 44px.
- **Primary actions in thumb reach.** Bottom of screen on mobile. Never top-right only.
- **Minimal decoration.** No decorative gradients, no glass blur on work screens, no shadows for their own sake.

## Color tokens (6 named)

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--ej-ink` | `#14181A` | Primary text, headings | 16.5:1 on white |
| `--ej-paper` | `#FFFFFF` | Page background | - |
| `--ej-smoke` | `#F2F4F3` | List row separator, subtle fill | - |
| `--ej-muted` | `#5A6366` | Secondary text, meta | 7.0:1 on white |
| `--ej-lime` | `#C8F542` | Fill behind dark text (buttons, highlights). Never as text on white. | Ink on lime: 11.2:1 |
| `--ej-alert` | `#C0392B` | Late, errors, destructive actions | 5.9:1 on white |

Lime works as a **fill behind dark text**, not as text on white. Lime text on white fails contrast. Lime background with ink text passes easily.

Status colors (used only in badges, never as body text):
- New: `#E8F0FE` bg, `#1A56DB` text
- Scheduled: `#FEF3C7` bg, `#92400E` text
- In progress: `#DBEAFE` bg, `#1E40AF` text
- Completed: `#D1FAE5` bg, `#065F46` text
- Cancelled: `#F3F4F6` bg, `#4B5563` text
- Late: `#FEE2E2` bg, `#991B1B` text
- Paid: `#D1FAE5` bg, `#065F46` text

## Type

**One typeface:** system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). No webfont download. Fast, familiar, readable in sunlight.

**Type scale:**

| Role | Size | Weight | Use |
|---|---|---|---|
| Page title | 24px / 1.25 | 700 | Page headers |
| Section title | 18px / 1.3 | 600 | Card/section headings |
| Body | 16px / 1.5 | 400 | Main content |
| Meta | 14px / 1.4 | 400 | Secondary info, muted |
| Small | 12px / 1.4 | 400 | Only for timestamps, never body copy |
| Money large | 32px / 1.1 | 700 | Dashboard totals, invoice totals |
| Money medium | 20px / 1.2 | 600 | List amounts |
| Time | 18px / 1.2 | 600 | Schedule times |

**Money and times use tabular figures** (`font-variant-numeric: tabular-nums`) so amounts line up in lists.

**Sentence case everywhere.** No all-caps labels. No em/en dashes. No arrows on buttons.

## Layout

**Lists, not card grids, on work screens.** Jobs, Schedule agenda, Money rows, Customers, Quotes, Invoices are vertical lists with dividers. One row = one item. Tap a row to open it.

**Cards only where grouping means something.** Dashboard summary, Money totals, Settings sections. A card groups related data. It is not a default container.

**Corner radius and shadow vary with hierarchy:**
- List rows: 0 radius, 1px bottom border (`--ej-smoke`). No shadow.
- Grouping cards: 12px radius, 1px border, no shadow.
- Floating actions (bottom sheet, dialog): 16px radius, 1px border + soft shadow (`0 8px 24px rgba(0,0,0,0.12)`).
- Never the same rounded-card-with-soft-shadow for everything.

**Spacing:** 16px page padding on mobile, 24px on desktop. 12px between list rows (vertical padding). 8px between label and value.

## One memorable element

**The "today" timeline on the Schedule screen.** A vertical line down the left of today's agenda, with a dot at the current time. Jobs above the dot are done or in progress. Jobs below are upcoming. Everything around it stays quiet — no other decorative elements compete.

Implementation: a 2px `--ej-lime` line with a 10px ink dot at the current-time position, computed from business timezone. Only on today's view. Other days show a plain list.

## Tap targets and thumb reach

- Primary actions: min 48px height, full-width on mobile or bottom-anchored.
- Secondary actions: min 44px.
- Filter chips: min 36px height, 12px horizontal padding.
- Bottom nav: 64px tall, icons 24px, labels 11px.
- Primary action (e.g. "New job") sits in thumb reach: bottom-right on mobile, or as a full-width button at the bottom of the list.

## Accessibility

- WCAG 2.2 AA: text contrast 4.5:1 minimum (all tokens pass, see table above).
- Focus visible: 2px `--ej-ink` outline, 2px offset.
- Touch targets: 44px minimum (48px for primary).
- Screen reader labels on all icon-only buttons.
- Reduced motion: respect `prefers-reduced-motion`, no animation on work screens.

## What changed from the old look

| Old (templated) | New (deliberate) |
|---|---|
| Near-black header | White header, ink text |
| One bright lime accent everywhere | Lime only as fill behind dark text on primary actions |
| Identical rounded cards + soft shadow | Lists with dividers; cards only for grouping; radius/shadow vary |
| All-caps labels | Sentence case |
| Glass blur | No blur on work screens |
| Floating mascot + robot button | Nothing floats (Part B) |
