# EveryJob Design System

**Status:** Part B (design direction and tokens). Written 2026-10-17. Supersedes the 2026-10-14 draft.  
**References:** Vercel Web Interface Guidelines (fetched 2026-10-17), Apple HIG principles (clarity, consistency, feedback, legibility — not visual effects).

---

## 1. Users and context

**The pro.** A plumber, electrician, or cleaner running a 1–5 person shop in Canada. They use their phone outdoors, in bright sunlight, in the cold, sometimes in gloves, and get interrupted constantly. They are not tech people. If the app needs configuring before it works, they will not configure it — they will go back to paper or texting.

**The homeowner.** Finds pros, requests quotes, approves work, pays invoices. On any device, iPhone or Android, often on a slow connection.

**The app's main job.** Show what needs doing next, and get the business paid. Everything else is secondary.

**Constraints that shape every decision:**
- Sunlight readability beats beauty. Contrast is not decoration.
- Gloves and cold mean 44px minimum touch targets, no tiny controls.
- Interruptions mean state must survive: drafts autosave, forms never lose input.
- Android is as important as iPhone. No iOS-only patterns.
- French text runs ~15% longer. Nothing important gets cut off in French.

---

## 2. Principles

1. **Truth first.** Every number is right and the same on every screen. If a number looks wrong, fix the source, never the display.
2. **What's next before what's there.** Every screen leads with the next action, not a museum of what exists.
3. **Readable anywhere.** Sunlight, gloves, 200% text size, French, dark mode. If it only works in ideal conditions, it doesn't work.
4. **Calm.** Colour always means something. Nothing moves without a reason. No decoration.
5. **Instant.** Every tap answers within 100ms. Key screens load in under 2.5s on 4G.

---

## 3. Brand anchor

**Lime stays.** It is the brand's signature. But it has exactly two jobs:

1. **Fill behind dark text** for the single primary action where black would disappear (e.g., on dark surfaces), and
2. **The active tab indicator** in the bottom nav.

**Black is the primary action colour** on light surfaces (Part A unified all primary buttons to `primaryBtnClass`/black). Lime is never text on white, never decoration, never a second "primary."

**Rules:**
- One primary action per screen. It is black on light, lime-fill on dark.
- Lime never appears as text, borders, or backgrounds except the two jobs above.
- If lime and black ever compete on the same screen, black wins and lime steps back to the active tab only.

---

## 4. Colour tokens

All colours are defined in `src/app/globals.css` (`@theme`). Components reference tokens, never raw values. Contrast ratios measured 2026-10-17 (WCAG 2.1 formula).

### Light mode

| Token | Value | Use | Contrast on bg |
|---|---|---|---|
| `--color-ej-bg` | `#ffffff` | Page background | — |
| `--color-ej-surface` | `#fafaf7` | Cards, grouped containers | — |
| `--color-ej-raised` | `#ffffff` | Popovers, sheets (over surface) | — |
| `--color-ej-border` | `#e8e8e3` | Borders, dividers | — |
| `--color-ej-ink` | `#161616` | Primary text | 18.1:1 ✅ |
| `--color-ej-secondary` | `#55554e` | Secondary text | 7.5:1 ✅ |
| `--color-ej-muted` | `#5a6366` | Muted text, placeholders | 6.2:1 ✅ |
| `--color-ej-disabled` | `#71717a` | Disabled text | 4.8:1 ✅ |
| `--color-ej-primary` | `#161616` | Primary action fill | 18.1:1 white text ✅ |
| `--color-ej-on-primary` | `#ffffff` | Text on primary | — |
| `--color-ej-accent` | `#c8f04a` | Lime: active tab, dark-surface primary | 13.8:1 ink text ✅ |
| `--color-ej-focus` | `#161616` | Focus ring | — |
| `--color-ej-success` | `#047857` | Success text | 5.5:1 ✅ |
| `--color-ej-success-bg` | `#ecfdf5` | Success background | 5.2:1 w/ text ✅ |
| `--color-ej-warning` | `#b45309` | Warning text | 5.0:1 ✅ |
| `--color-ej-warning-bg` | `#fffbeb` | Warning background | 4.8:1 w/ text ✅ |
| `--color-ej-danger` | `#c0392b` | Danger text | 5.4:1 ✅ |
| `--color-ej-danger-bg` | `#fef2f2` | Danger background | — |
| `--color-ej-info` | `#1d4ed8` | Info text | 6.3:1 ✅ |
| `--color-ej-info-bg` | `#eff6ff` | Info background | — |

### Dark mode

Dark mode tokens are defined for forward compatibility. The app does not yet have a dark-mode toggle; when it does, these are the values.

| Token | Value | Contrast |
|---|---|---|
| `--color-ej-bg-dark` | `#161616` | — |
| `--color-ej-surface-dark` | `#1e2426` | — |
| `--color-ej-ink-dark` | `#f5f5f4` | 16.6:1 ✅ |
| `--color-ej-muted-dark` | `#a8b0b3` | 8.2:1 ✅ |
| `--color-ej-accent-dark` | `#c8f04a` | 13.8:1 ink text ✅ |
| `--color-ej-success-dark` | `#6ee7b7` | 11.9:1 ✅ |
| `--color-ej-warning-dark` | `#fcd34d` | 12.6:1 ✅ |
| `--color-ej-danger-dark` | `#fda4af` | 9.6:1 ✅ |

### Status colour rule

**Status colour is always paired with an icon or a word.** Never colour alone. A red dot means nothing to a colourblind user in sunlight. A red triangle plus the word "Late" means something to everyone.

---

## 5. Type

**Font stack** (system native, no webfont download):
```css
--font-ej-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```
System fonts feel native on every phone and cost zero load time. (The project currently loads Geist; migrate to system stack in Part C.)

**Type scale** (named roles, not sizes):

| Role | Size / Weight | Line height | Use |
|---|---|---|---|
| `title` | 28px / 700 | 1.2 | Screen titles |
| `headline` | 20px / 700 | 1.3 | Card titles, section headers |
| `body` | 16px / 400 | 1.5 | Default text, list rows |
| `callout` | 14px / 600 | 1.4 | Labels, buttons, chips |
| `footnote` | 12px / 400 | 1.4 | Hints, timestamps, captions |

**Rules:**
- Inputs are at least 16px. Below 16px, iOS zooms on focus. No exceptions.
- Money, times, and counts use tabular figures (`font-variant-numeric: tabular-nums`) so columns align.
- Maximum line length 65ch for body text.
- Test at 200% text size. Layout must not break; truncation is never the answer for important content.

---

## 6. Space

**Base grid:** 4px. All spacing is a multiple of 4.

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Tight gaps, icon padding |
| `--space-2` | 8px | Default gap between related items |
| `--space-3` | 12px | Card internal padding (compact) |
| `--space-4` | 16px | Page padding (mobile), card padding |
| `--space-5` | 20px | Card padding (comfortable) |
| `--space-6` | 24px | Section gaps |
| `--space-8` | 32px | Large section gaps |
| `--space-12` | 48px | Page padding (desktop) |

**Rules:**
- Page padding: 16px mobile, 32px desktop.
- Tappable list rows: minimum 56px height, 44px minimum touch target.
- Bottom nav clearance: content gets `padding-bottom` equal to nav height + safe area. Never hide content under bars (WCAG 2.4.11).

---

## 7. Shape and depth

**Radius by hierarchy:**

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Inputs, chips, small buttons |
| `--radius-md` | 12px | Cards, grouped containers |
| `--radius-lg` | 16px | Sheets, dialogs, large cards |
| `--radius-pill` | 999px | Only where shape means something (toggles, status pills) |

**Elevation** (three levels, each with a purpose):

| Token | Use |
|---|---|
| `--elevation-1` | Sticky bars (top bar, bottom nav) — subtle separation |
| `--elevation-2` | Sheets, popovers — clearly above content |
| `--elevation-3` | Dialogs, toasts — highest, demands attention |

**Rules:**
- Flat lists get no shadows. Shadows mean "this floats above."
- No glass, blur, or gradient decoration. Surfaces are solid.
- One radius per hierarchy level. A card and a chip do not share a radius.

---

## 8. Icons

**One set:** Lucide (`lucide-react`, already in use).  
**One stroke weight:** 2px (Lucide default).  
**Two sizes:** 16px (inline, chips) and 20px (buttons, nav). 24px only for empty-state illustrations.

**Rules:**
- Icons for navigation, status, and actions only. No decorative icon tiles.
- Every icon-only button has an `aria-label`.
- Decorative icons get `aria-hidden="true"`.
- Status icons always accompany a text label (see §4).

---

## 9. Motion

**Durations:** 100–250ms. Nothing longer.

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 100ms | Pressed states, toggles |
| `--motion-base` | 200ms | Sheets, expanding rows |
| `--motion-slow` | 250ms | Page transitions (max) |

**Easing:** `cubic-bezier(0.32, 0.72, 0, 1)` (ease-out, iOS-like).

**Rules:**
- Animate only state changes caused by the user (opening a sheet, expanding a row, confirming an action).
- Nothing animates on page load.
- Respect `prefers-reduced-motion`: disable all non-essential animation.

---

## 10. Density

**Phones:** Comfortable. 56px rows, 16px padding, one column. Thumb-reachable primary actions.

**Desktop (1024px+):** Denser. Tables instead of cards where it helps, two-pane list+detail, 12px padding in tables. More information per screen, same touch targets for interactive elements.

---

## 11. Not this

The AI-built defaults we are avoiding, and what we do instead:

| Instead of... | We do... |
|---|---|
| Identical cards with one radius and one shadow | Radius by hierarchy (§7); flat lists have no shadow |
| Rainbow icon tiles | One icon set, no decorative tiles (§8) |
| Big number + small label for everything | Label includes its time range; empty variant when no data |
| Labels joined with middle dots | Plain words or commas |
| Arrows on "View all" | Plain "View all", no arrow |
| ALL-CAPS labels | Sentence case everywhere |
| Glossy/glass/blur effects | Solid surfaces, no translucency |
| Decorative gradients | Flat fills; gradients only for button depth (subtle) |
| Entrance animations on every section | No load animations (§9) |
| Spaced hyphens as dashes | Commas, parentheses, or periods |
| Unmeasured claims ("in 20 seconds") | No claims we haven't measured |
| Exclamation marks | Periods. Calm. |
| Two primary button styles | One: black on light (§3) |

---

## 12. Self-review

Checked against §1 (users and context):

- **Sunlight:** All text pairs ≥4.5:1. Status never colour-alone. ✅
- **Gloves:** 44px targets, 56px rows, 16px inputs. ✅
- **Interruptions:** Tokens don't solve this; Part E (screens) must ensure drafts autosave. ⚠️ Flagged for Part E.
- **Android:** System font stack, no iOS-only patterns. ✅
- **French:** Type scale tested at 200% covers French length; Part F verifies per-screen. ⚠️ Needs verification.
- **"Would look the same on any other app":** The lime-on-black brand anchor and the trades-specific density (56px rows, outdoor-first contrast) are distinctive. The principles are generic enough to be true but specific enough to check. Acceptable.

**Open questions:**
1. Migrate from Geist to system font stack now, or in Part C with the component library?
2. Dark mode: build the toggle now, or ship tokens and add the toggle in Part E?
3. The 50+ remaining copy violations from Part A — bulk-fix or gradual?

---

## Token implementation

Defined in `src/app/globals.css` (`@theme` block). Components use `bg-ej-*`, `text-ej-*`, `border-ej-*` utilities. Raw hex/rgb/hsl outside `globals.css` fails the design lint (`scripts/check-design-tokens.mjs`, in CI).
