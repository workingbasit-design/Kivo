# EveryJob design scorecard

**Status:** Part J, item 6. Written 2026-10-17. Measured against the bar in `docs/PROMPTS-DESIGN.md`.

This is an honest ledger, not a launch announcement. Every line says what was done, what was not, and where the evidence is. Nothing is marked done without evidence.

## The bar, line by line

| Bar | Status | Evidence |
|---|---|---|
| 5 real tradespeople complete 5 core tasks unaided, at least 4 of 5 succeed at every task, no critical errors | **Not yet tested** | The test kit is ready: `docs/design/usability-test.md`. No sessions run yet. |
| SUS averages 80 or higher (average product: 68) | **Not yet measured** | SUS questionnaire (EN and FR) is in the test kit. No scores collected yet. |
| Zero contradictions: the same fact shows the same value on every screen, proven by automated tests | **Partial** | Part A fixed the known contradictions (setup card math, profile strength, UTC-midnight date bug, stat labels, button styles) with root causes in `docs/design/part-a.md`. The seeded-data consistency suite (Part A item 11) was deferred, so cross-screen equality is not yet proven by tests. |
| WCAG 2.2 AA automated checks pass on every screen, plus VoiceOver and TalkBack runs of the core tasks | **Partial** | axe checks run on the `/design` page (Part C). Full per-screen audit and the VoiceOver/TalkBack runs are Part H, not done. |
| Every tap shows a response within 100 ms | **Not yet measured** | Part I not done. Components use 100 to 250 ms motion tokens and loading states keep labels (`docs/DESIGN.md` section 9), but nothing was measured on a device. |
| Key screens load in under 2.5 s on a mid-range phone on 4G | **Not yet measured** | Part I not done. No Lighthouse or device measurements taken. No CI speed budget exists. |
| Every screen works at 320 px wide | **Partial** | 44 px targets, 56 px rows, 16 px inputs are in the tokens and components (`docs/DESIGN.md`). No 320 px screenshot pass was run. |
| Every screen works at 200% text size | **Partial** | Designed for (no fixed heights on text containers, visible labels). Not verified per screen. |
| Every screen works in French | **Done for copy** | i18n parity passes (EN/FR key counts equal), 559 copy violations fixed in Part G, Quebec French glossary in `docs/VOICE.md`. French layout overflow not checked per screen. |
| Every screen works in dark mode | **Partial** | Dark-mode token palette is defined with measured contrast ratios (`docs/DESIGN.md` section 4). No dark-mode toggle exists yet, so dark mode is not shippable. |
| Every screen works offline with a clear message | **Not done** | No offline handling or offline indicator wiring beyond the component existing in the library. |
| Every screen works with 500+ jobs | **Not done** | No heavy-data test or screenshot pass was run. |

## Per-part status

| Part | Status | Main output |
|---|---|---|
| A. Truth fixes (12 items) | 10 of 12 done | `docs/design/part-a.md`; copy lint and design-token lint in CI |
| B. Design direction and tokens | Done | `docs/DESIGN.md`; tokens in `src/app/globals.css` |
| C. Component library | Done (core set) | `src/components/design/`; `/design` showcase page; axe checks |
| D. Navigation and structure | Done | Tab bar rebuilt; Dashboard renamed to Today; one primary action per screen |
| E1. Today | Done | `docs/design/screens/today.md` |
| E2. Schedule | Done | `docs/design/screens/schedule.md` |
| E3. Jobs | Done | `docs/design/screens/jobs.md` |
| E4. Money | Done | `docs/design/screens/money.md` |
| E5. Customers and leads | Done | `docs/design/screens/customers.md` |
| E6. Projects | Done | `docs/design/screens/projects.md` |
| E7. Settings and onboarding | Done | `docs/design/screens/settings.md` |
| E8. Customer-facing pages | Done | `docs/design/screens/customer-facing.md` |
| F. State matrix | Not done | Needs authenticated screenshot sessions |
| G. Words | Done | `docs/VOICE.md`; `docs/design/error-catalogue.md`; `docs/design/voice-changes.md` |
| H. Accessibility deep pass | Not done | Not started |
| I. Feel (speed, motion, feedback) | Not done | Not started |
| J. Proof | Partial | Usability test kit done; visual regression, design lint extras, consistency suite, heuristic review not done |

## What is true right now

- The app no longer contradicts itself on the screens the founder screenshotted on Oct 17: setup progress, dates, stat labels, button styles, and the project form are fixed at the source.
- All user-facing copy follows `docs/VOICE.md`. CI fails on new violations (dashes, middle dots, exclamation marks, all-caps).
- Design tokens are the only allowed source of colour, spacing, radius, and motion. CI fails on raw values outside the tokens file.
- Unit tests: 1356 of 1356 pass. Typecheck clean. Production build succeeds.

## What would change the remaining red lines to green

1. Run the 5 usability sessions with `docs/design/usability-test.md`. This alone clears the two most important bar lines (task success, SUS).
2. Write the seeded-data consistency suite (Part A item 11) and run it in CI. This proves zero contradictions.
3. Run the Part H accessibility audit and the VoiceOver/TalkBack task runs.
4. Measure tap response and load times on a real mid-range Android phone; add the CI speed budget (Part I).
5. Run the Part F state-matrix screenshot pass (320 px, 200% text, French, dark mode once the toggle exists, offline, 500+ jobs).
6. Add visual regression screenshots to CI and run the heuristic review (remaining Part J items).

## Open questions carried from the morning report

1. Delete `limeBtnClass` or reserve it for a specific use?
2. Dark mode toggle: build now or later?
3. Migrate from Geist to the system font stack now or later?
4. When do the 5 usability test sessions run?
