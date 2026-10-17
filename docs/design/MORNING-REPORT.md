# Design Overhaul — Morning Report (2026-10-17)

## What got done overnight

11 of the 17 design parts are complete and pushed to `origin/main`. All commits verified, all tests pass (1352/1352), tsc clean, build succeeds.

### Part A: Make every screen tell the truth (10/12 items)
**Commits:** `cce295d`, `3f25955`
- ✅ Setup card contradiction fixed — card removed when all steps done
- ✅ Profile strength removed — single checklist, one source of truth
- ✅ Date inconsistencies fixed — UTC-midnight bug found and fixed, `formatDisplayDate()` helper
- ✅ One date style — "Today"/"Yesterday"/"Tue, Sep 29", never ISO
- ✅ Stat labels fixed — describe the exact number + time range
- ✅ Buttons unified — one primary style (black)
- ✅ Project form — budget renamed, customer picker fixed, date validation
- ✅ Copy lint in CI — fails on dashes, middle dots, exclamation marks, all-caps
- ⚠️ Briefing rows — urgency signal + grammar fixed, one-tap buttons deferred to Part E
- ⚠️ Copy — key strings fixed, 559 violations bulk-fixed in Part G
- ❌ Consistency suite — deferred (needs seeded test infrastructure)

### Part B: Design direction and tokens
**Commit:** `5a66975`
- `docs/DESIGN.md` — users, 5 principles, brand anchor (black primary, lime accent), color tokens with measured contrast ratios (all ≥4.5:1), type scale, spacing, shape, icons, motion, density
- Tokens in `src/app/globals.css` (@theme block)
- Design lint in CI (`scripts/check-design-tokens.mjs`)

### Part C: Component library
**Commit:** `720f956`
- `src/components/design/` — Button, Input, MoneyInput, DateField, ListRow, EmptyState, Dialog, BottomSheet, Banner, Toast, Timeline, and 20+ more
- `/design` page (dev/admin only) — interactive showcase of every component in every state
- All components: 44px targets, visible labels, aria-describedby, tokens only

### Part D: Navigation
**Commit:** `01f1b66`
- BottomNav rebuilt — solid surface (no glass), active tab = filled icon + lime indicator, all 5 items styled identically
- Dashboard → "Today" rename (EN/FR)
- Duplicate "New job" CTA removed

### Part E: Screens (6 of 8 done)
- **E1 Today** (`dd38f02`) — reordered: attention first, agenda, money (only with data), checklist last. New businesses see checklist + "Create your first job", no $0.00 cards
- **E2 Schedule** (`2ff29c3`) — week strip, conflict warnings, desktop drag-and-drop with non-drag alternative
- **E3 Jobs** (`913282f`) — sort control, one date style, row action menu, status timeline, map link
- **E4 Money** (`447cfbc`) — three lists (ready to invoice, awaiting payment, awaiting decision), no giant $0.00 cards
- **E5 Customers** (`aa0d420`) — one-tap call/text/email/map, unified timeline, lead decline with reason
- **E6 Projects** (`719fb82`) — phases as add/remove/reorder list, trade templates, MoneyInput, detail money section

### Part G: Words
**Commit:** `4e0403b`
- `docs/VOICE.md` — voice guide, EN/FR glossary, number/date/currency rules
- **559 copy violations fixed** — all spaced hyphens, middle dots, em dashes removed
- `docs/design/error-catalogue.md` — 118 errors with EN/FR messages
- Before/after log: `docs/design/voice-changes.md` (663 strings)

## What was NOT done

- **E7 Settings/onboarding** — settings grouping, 3-question first run
- **E8 Customer-facing pages** — public profile, booking, quote approval
- **F State matrix** — systematic screenshots of every screen/state (needs authenticated mobile-qa session)
- **H Accessibility deep pass** — WCAG 2.2 AA audit, VoiceOver/TalkBack runs
- **I Feel** — 100ms tap response, optimistic updates, speed budgets
- **J Proof** — visual regression CI, heuristic review, usability test kit, final scorecard

## CI status

Latest commit `719fb82` — CI queued at 02:37 EDT. Previous commits all green (validate, db-tests, audit).

## Open questions for you

1. Delete `limeBtnClass` or reserve it for a specific use?
2. Dark mode toggle — build now or later? (tokens are ready)
3. Migrate from Geist to system font stack now or later?
4. The 5 usability test participants — when do you want to run them?
