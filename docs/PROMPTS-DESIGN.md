# EveryJob (Kivo): design overhaul prompts

## Read this part yourself (not for Muse)

**What "better than Apple" should mean here.** "Perfect" and "better than Apple" can't be checked, so Muse will say it got there and you'll have no way to verify. [Likely] What Apple actually does well is copyable and testable: the same word means the same thing everywhere, numbers you can trust, every tap answers instantly, text you can read in sunlight and at large text sizes, nothing hidden under bars, one obvious main action per screen, and calm. What not to copy is the glass look. Apple's own translucent design drew legibility complaints, and iOS 27 added a slider so people can turn it down. [Certain] Your users work outdoors, which makes legibility matter even more. Many of them will also be on Android, so iPhone-only patterns are out. [Likely]

### What your new screenshots show (Oct 17, 2026)
1. **The setup card contradicts itself:** "3 of 6 complete", "100%", a full progress bar, and "You are all set up" all at once. [Certain]
2. **Two progress systems disagree:** "Get set up" says you're done, while "Profile strength" says 35 of 100 and asks you to add a price book service. [Certain]
3. **The same jobs show different dates.** On Oct 13 your Jobs list showed "Home cleaning" on Sep 30 and Oct 7. Today's briefing says 2026-09-29 and 2026-10-06, while "Service" on Oct 4 matches. [Certain that the dates differ] The usual cause is a date-only value read as midnight UTC, which shows up as the previous day in Toronto. [Likely]
4. **Mixed date formats:** "2026-09-29" in the briefing, "Oct 17, 2026" everywhere else. [Certain]
5. **Stat subtitles don't describe their numbers.** "New leads: 0" sits over "2 total customers". "Booked today" says "0 jobs still open" while the briefing lists three late jobs. [Certain]
6. **The most urgent thing is buried.** Three late jobs sit below a setup card and four $0.00 cards. They have no action buttons, each carries two red alarms (a dot and a triangle), and the copy is awkward ("never started - Farha", "is still not started"). [Certain]
7. **Two primary button styles:** a lime "New job" and black "New job", "New quote" and "Create project". [Certain]
8. **The project form has several problems:**
   - The End date field spills past the card edge.
   - The phases hint is shown twice, and it uses commas while the label says one per line.
   - The customer picker shows "-".
   - The budget shows "2500" with no formatting.
   - "Budget" could mean your cost or the customer's price.
   [Certain]
9. **Copy habits:**
   - Spaced hyphens are being used as dashes ("breather - or book", "set up - nice work"), which is the em dash habit in disguise.
   - "Book a job in under 20 seconds" is a claim nobody has measured.
   - Labels are still joined with middle dots.
   - "View all" still has an arrow.
   [Certain]
10. **"Good morning" appears at 1:05.** If that was the afternoon, the greeting is wrong. [Guessing about AM or PM]
11. **The look is the common AI-built kit:** identical cards with the same radius and shadow, rainbow icon tiles, a big $0.00 with a small label, glossy nav bubbles, and "More" styled differently from the other tabs. [Likely]

### The bar ("done" means every line has evidence)
- 5 real tradespeople complete 5 core tasks on their own phones without help: create a job, send a quote, record a payment, find a past job, reschedule a visit. Target: at least 4 of 5 people succeed at every task, with no critical errors. [Guessing on thresholds; adjust after the first round]
- System Usability Scale (SUS, a 10-question survey) averages 80 or higher. The average product scores about 68. [Likely]
- Zero contradictions: the same fact shows the same value on every screen, proven by automated tests.
- WCAG 2.2 AA automated checks pass on every screen, plus a VoiceOver and TalkBack run of the core tasks.
- Every tap shows a response within 100 ms, and key screens load in under 2.5 s on a mid-range phone on 4G.
- Every screen works at 320 px wide, at 200% text size, in French, in dark mode, offline (with a clear message), and with 500+ jobs.

### How to use this file
- Save it in your repo as `docs/PROMPTS-DESIGN.md`.
- Run the parts in order, one per session, with the line under "Start Muse with".
- Part A comes first, because polish on top of contradictions won't feel like Apple; it will feel broken, just prettier.
- Parts B and D stop for your approval before any building.

---

## Standing design rules (Muse: follow these in every part)

Read AGENTS.md (same rules as Part 0 of docs/PROMPTS.md) and follow it.

1. Work only on the part named in my start line.
2. **Screenshots are the evidence.** Before changing anything, take "before" screenshots. After, take "after" screenshots of the same screens at 390x844 and 430x932, in light and dark mode, in English and French. Save them under `docs/design-screens/<part>/`. A design change without before and after screenshots is not done.
3. **Tokens only.** No raw hex colours, font sizes, spacing or shadows inside components. Add a lint check that fails on raw values outside the tokens file.
4. **References.**
   - Follow Vercel's Web Interface Guidelines. Fetch the current rules from https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md rather than relying on memory.
   - Follow the principles of Apple's Human Interface Guidelines (clarity, consistency, feedback, legibility), not Apple's visual effects.
   - If a reference conflicts with this file, ask me.
5. **Avoid the AI-built look:**
   - identical cards with one radius and one shadow
   - rainbow icon tiles
   - a big number with a small label as the default for everything
   - labels joined with middle dots
   - arrows appended to link or button text
   - all-caps labels
   - glossy, glass or blur effects
   - decorative gradients
   - entrance animations on every section
6. **Copy rules** from AGENTS.md, plus:
   - no spaced hyphens used as dashes ("x - y")
   - no claims we haven't measured
   - no exclamation marks
   - sentence case everywhere
7. **Never change what data means to make a screen look nicer.** If a number looks wrong, fix the source and add a test.
8. **Report** the list of changes, screenshots, test output and open questions. Then stop.

---

## Part A: Make every screen tell the truth (do this first)

**Start Muse with:** `Read docs/PROMPTS-DESIGN.md and do Part A only. Stop where it says to stop.`

Fix each item. For each: find the root cause (file:line), fix it at the source, add a test, and show before and after screenshots.

1. **Setup card.** It shows "3 of 6 complete", "100%", a full progress bar and "You are all set up" at the same time. Compute progress from the same data as the step list. Show "all set up" only when every step is done, then remove the card. "Do later" hides it and leaves a way to bring it back.
2. **Two progress systems.** "Get set up" and "Profile strength 35 of 100" disagree. Merge them into one checklist with one source of truth. If a directory profile score is still needed, show it in the directory listing settings, and make its steps part of the same checklist.
3. **Same job, different dates.**
   - On Oct 13 the Jobs list showed "Home cleaning" on Sep 30 and Oct 7. The dashboard briefing now says 2026-09-29 and 2026-10-06, while "Service" on Oct 4 matches.
   - Find the cause. Check first for a date-only value parsed as midnight UTC and then displayed in America/Toronto.
   - Fix it at the source and route every date through the single shared formatter.
   - Add a test that renders the same job's date on every screen (Jobs list, job detail, schedule, dashboard briefing, action board, emails, PDFs) and asserts they match in America/Toronto, America/Vancouver and America/St_Johns.
4. **One date style everywhere.**
   - Use "Today", "Tomorrow" and "Yesterday" where they apply.
   - Within the current year, show weekday, month and day (for example "Tue, Sep 29"). Add the year outside it.
   - Show how late something is when that's the point ("3 days late").
   - Never show ISO dates to users.
5. **Stat cards.** "New leads 0" sits over "2 total customers", and "Booked today" says "0 jobs still open" while three jobs are late. Each stat label must say exactly what the number is, including its time range. A subtitle either adds context about that same number or goes.
6. **Greeting.** Compute it in the business time zone (morning, afternoon, evening) or remove it.
7. **Briefing rows.**
   - Each row shows the job title, the customer, and how late it is, using the date style from item 4.
   - Each row gets one-tap actions: Start, Reschedule, Cancel.
   - One urgency signal per row, not a red dot plus a red triangle.
   - Plain grammar: "hasn't started", not "is still not started".
8. **Buttons.** One style for the main action on every screen. Secondary, tertiary and destructive styles are defined in tokens. Lime and black can't both mean "primary".
9. **Project form.**
   - Fix the End date overflow.
   - Replace the phases textarea with an add, remove and reorder list, plus phase templates by trade (for example bathroom reno).
   - The customer picker searches, offers "No customer" and "New customer", and never shows "-".
   - The money input has a $ prefix, thousands separators, the decimal keyboard, and fr-CA formatting in French.
   - Rename "Budget" to "Contract price (what the customer pays)". If a cost budget is also needed, make it a separate field.
   - The end date can't be before the start date.
   - Show each hint once, not as both a placeholder and helper text.
10. **Copy.**
    - Remove spaced hyphens used as dashes ("Enjoy the breather - or book a job", "You are all set up - nice work").
    - Remove unmeasured claims ("in under 20 seconds").
    - Remove middle dots in labels.
    - Remove the arrow on "View all".
11. **Consistency suite.** Add automated tests proving that, on seeded data, every number and date shown for the same record or metric matches across all screens.
12. **Copy lint.** Add a CI check on all translation files that fails on em dashes, en dashes, spaced hyphens between words, middle dots, exclamation marks, and all-caps strings.

**Output:** `docs/design/part-a.md` with each fix, its root cause, screenshots and test output. Then stop.

---

## Part B: Design direction and tokens (approval gate)

**Start Muse with:** `Read docs/PROMPTS-DESIGN.md and do Part B only. Stop where it says to stop.`

Write a new `docs/DESIGN.md` and wait for my OK before building anything.

1. **Users and context.**
   - The people: tradespeople running small home-service businesses in Canada. They use phones outdoors, in bright light, in the cold, sometimes in gloves, and get interrupted constantly.
   - The other side: homeowners on any device.
   - The app's main job: show what needs doing next, and get the business paid.
2. **Principles (five at most).** Proposed, revise if you have better:
   - Truth first: every number is right and the same everywhere.
   - What's next before what's there: every screen leads with the next action.
   - Readable anywhere: sunlight, gloves, big text, French.
   - Calm: colour always means something; nothing moves without a reason.
   - Instant: every tap answers.
3. **Brand anchor.** Ask me whether lime stays. If it stays, it's a fill behind dark text for the single primary action and the active tab. Never text on white, never decoration.
4. **Colour tokens, light and dark.**
   - Base: background, surface, raised surface, border, primary text, secondary text, disabled text, primary action, text on primary, focus ring.
   - Semantic: success, warning, danger, info, each with background and text variants.
   - List the measured contrast ratio for every text and background pair: at least 4.5:1 for normal text, and 3:1 for large text and UI parts.
   - Status colour is always paired with an icon or a word.
5. **Type.**
   - Default to the system font stack (-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif): native feel on every phone and no font loading. Propose a brand typeface only with a clear reason, and say what it costs in load time.
   - A type scale with named roles: title, headline, body, callout, footnote.
   - Inputs at least 16 px.
   - Tabular figures for money, times and counts.
   - Line height and maximum line length for each role.
   - Test at 200% text size. Check whether Safari's system text styles (for example `font: -apple-system-body`) follow the iPhone text size setting, and use them if they work reliably.
6. **Space.** A 4 px base grid, spacing tokens, page padding, and a minimum height of 56 px for tappable list rows.
7. **Shape and depth.**
   - Radius by hierarchy: small for inputs and chips, medium for grouped containers, pills only where the shape means something.
   - Two or three elevation levels with a purpose each (sticky bar, sheet, popover).
   - Flat lists get no shadows.
8. **Icons.** One icon set, one stroke weight, two sizes. Icons for navigation, status and actions only. No decorative icon tiles.
9. **Motion.**
   - Durations of 100 to 250 ms and the easing curves.
   - Animate only state changes caused by the user (sheets, expanding rows, confirmations).
   - Define behaviour under reduced motion.
10. **Density.** Comfortable on phones, denser on desktop (tables, two-pane layouts).
11. **"Not this."** A section listing the AI-built defaults we're avoiding and what we do instead.
12. **Self-review.** Check the plan against the users and context. Revise anything that would look the same on any other app, and say what you changed and why.

Stop and wait for my OK.

---

## Part C: Component library with every state

**Start Muse with:** `Read docs/PROMPTS-DESIGN.md and do Part C only. Stop where it says to stop.`

Build or refactor these components on the approved tokens. Add an internal `/design` page, available only in development or to admins, showing every component in every state, in light and dark, English and French.

**Components**
- **Buttons and links:** Button (primary, secondary, tertiary, destructive; two sizes; loading keeps its label), IconButton (always has an accessible name), Link.
- **Form fields:** Input, Textarea, Select and Picker (a searchable bottom sheet on phones), DateField (native picker on phones), TimeField, MoneyInput, PhoneInput (Canadian formatting), AddressInput (correct autocomplete attributes), Checkbox, Radio, Switch, SegmentedControl.
- **Navigation and filtering:** Tabs, FilterChip, SearchField, TabBar (bottom nav), TopBar (large title that collapses on scroll, back button showing the previous screen's name).
- **Lists and content:**
  - ListRow: title, subtitle, trailing value, chevron, and swipe actions that always have a visible menu alternative.
  - Stat: the label includes its time range; has an empty variant.
  - StatusBadge (icon plus text), SectionHeader, Avatar with initials, Timeline (status history), Table (desktop).
- **Feedback and states:**
  - EmptyState (compact and full), Skeleton, Banner (info, warning, error, success, each with an action), OfflineIndicator.
  - Toast (with Undo, announced to screen readers), ProgressChecklist.
- **Overlays and flows:** BottomSheet, Dialog and ConfirmDialog (destructive wording names the exact thing), Menu and Popover, Stepper (multi-step forms), StickyActionBar (sits above the keyboard and the home indicator).

**Every component shows these states** where they apply: default, hover (desktop), pressed, focus-visible, disabled (with the reason available), loading, error, success, selected, read-only. Also show each with long text, French text, 200% text, and dark mode.

**Rules**
- Hit areas at least 44 px on phones.
- Labels are always visible; never a placeholder used as a label.
- Every field has slots for helper text and error text, linked with aria-describedby.
- Showing an error never shifts the layout.
- Visual snapshot tests for every component state; axe checks on the `/design` page.

Stop for my review.

---

## Part D: Navigation and structure (approval gate)

**Start Muse with:** `Read docs/PROMPTS-DESIGN.md and do Part D only. Stop where it says to stop.`

Propose first: a text tree of the app's structure plus wireframes at 390 px. Wait for my OK, then build.

1. **Bottom tab bar.**
   - At most five destinations, each with icon and label.
   - The active tab shows a filled icon, colour and label weight. No glossy bubbles.
   - Every item is styled the same, including More.
   - It respects the safe area and never hides content: scroll areas get matching bottom padding, and a focused element is never hidden under it (WCAG 2.4.11).
2. **Use UAT evidence (`docs/UAT_TRIAGE.md`) to decide two things:**
   - Should "Dashboard" become "Today", led by what needs attention?
   - What order should the More menu use? Order it by how often testers used each item.
3. **Top bar.** The same layout on every screen: title, back (with the previous screen's name), search, notifications, Copilot.
4. **One primary action per screen, always in the same place.**
   - List screens: a "New" action in the top bar.
   - Forms: a sticky Save bar.
   - Remove duplicate calls to action. The dashboard currently has two "New job" buttons.
5. **Every record has its own URL.** Back returns to the same scroll position and filters.
6. **Wide screens.** From 1024 px, a sidebar, plus a list and detail side by side where it helps.
7. **Global search** across customers, jobs, quotes and invoices, with grouped results and recent searches.
8. **Notification centre.** Read and unread states, and each notification links to its record. The bell shows a count only for things that need action.

---

## Part E: Screen-by-screen redesign

**Start Muse with:** `Read docs/PROMPTS-DESIGN.md and do Part E, group E1 only. Stop where it says to stop.` (Then E2, E3, and so on in later sessions.)

**For each screen, first write a short brief in `docs/design/screens/<screen>.md`:**
- the screen's job
- its primary action
- what the user must understand within 3 seconds
- a 390 px wireframe

Then build it and capture the Part F states.

**E1. Today (dashboard)**
- Order the screen: what needs you (from the attention engine, with one-tap actions), then today's visits as an agenda, then a compact money summary (one row per metric, only metrics that matter or have data), then the setup checklist until it's done.
- For a new business, replace the four $0.00 cards with the checklist and one "Create your first job" action. Show stats once there's data.
- The date line reads "Saturday, October 17". Show a greeting only if it's correct for the time.

**E2. Schedule**
- A week strip plus that day's agenda.
- Today is highlighted in the business time zone.
- Conflict warnings.
- Drag and drop on desktop, always with a non-drag way to move a visit (WCAG 2.5.7).

**E3. Jobs**
- List row: title, customer, when, status badge, amount.
- Filter chips, search, sort, and swipe actions with a menu alternative.
- Job detail: a status timeline and a sticky primary action that matches the status (Start job, Complete, Invoice). Map link, photos, notes, costs. Sections collapse.

**E4. Money, quotes and invoices**
- Money becomes a hub with three lists: ready to invoice, awaiting payment, awaiting a decision. Each list shows its items, not a giant $0.00.
- Quote and invoice builder on a phone:
  - line items as rows, each edited in a sheet
  - a quantity stepper and price book search
  - live totals in a sticky footer, with the tax breakdown from the server
  - "Preview as customer" and a send sheet
- Record payment happens in a sheet.

**E5. Customers and leads**
- Customer detail: call, text, email and map actions; a history timeline; properties.
- Lead triage: accept or decline, with the reason captured.

**E6. Projects**
- Apply the Part A form fixes.
- Project detail: phases with progress, tasks, visits, and money (contract price, invoiced, paid, remaining).

**E7. Settings and onboarding**
- Settings are grouped and searchable.
- First run asks three questions (trade, team size, province), then shows a checklist tailored to the answers.

**E8. Customer-facing pages** (public profile, booking, quote request, quote approval, invoice payment)
- Show trust signals: licence, insurance, reviews.
- Show clear prices with the tax breakdown.
- Offer English and French.
- No login needed for portal links.
- Fast on any phone, including older Android.

---

## Part F: Every scenario (state matrix)

**Start Muse with:** `Read docs/PROMPTS-DESIGN.md and do Part F only. Stop where it says to stop.`

For every screen, seed the data needed and screenshot each state. Record pass or fail in `docs/design/state-matrix.md`, a table of screen by state with links to the screenshots.

**Data states**
- First use (empty).
- Loading: a skeleton shaped like the real layout.
- Normal.
- Heavy: 500+ jobs, 50 line items, long names and addresses, $1,234,567.89.
- Partial failure: one section fails and the rest still works.
- Full failure: server error with a retry.
- Offline: a clear banner; safe actions are queued, or blocked with a message.
- Slow network: nothing is saved twice.
- Validation errors: inline errors plus a summary.
- Permission denied: the technician's view.
- Not found: a link to a deleted record.
- Session expired mid-form: the input is preserved.
- Success confirmation.
- Destructive confirm, and undo where it's safe.

**Environment states**
- Light and dark.
- English and French. French usually runs longer; nothing important gets cut off.
- Default text size and 200%.
- Widths of 320 px, 390 px, 430 px, landscape, 768 px, 1024 px and 1440 px.
- The keyboard open on every form: the focused field and Save stay visible.
- One-handed reach: primary actions in the bottom half on phones.
- Increased contrast and reduced motion settings.
- VoiceOver on iPhone and TalkBack on Android.

**Time and role states**
- Near midnight and on daylight saving change days.
- Different business time zones.
- Owner, admin, dispatcher, technician, and customer.

---

## Part G: Words

**Start Muse with:** `Read docs/PROMPTS-DESIGN.md and do Part G only. Stop where it says to stop.`

1. **Write `docs/VOICE.md`:**
   - Voice: plain, calm, specific, respectful of the trade.
   - Tone by situation:
     - Errors say what happened and what to do, without apologizing.
     - Success messages confirm the exact thing done ("Invoice sent to Farha").
     - Empty states say what goes here and offer one action.
   - Banned: exclamation marks, "Oops", jokes in errors, unmeasured claims, dashes, middle dots.
   - Terminology glossary in English and Quebec French: job, visit, quote and soumission, invoice and facture, late, overdue, customer and client, lead, deposit, price book.
   - Rules for numbers, dates, times and currency in Canadian English and Quebec French.
2. **Rewrite every string** in the app against `VOICE.md`. Give me a before and after list to review.
3. **Error catalogue:** every error the app can show gets a user message in English and French.

---

## Part H: Accessibility deep pass

**Start Muse with:** `Read docs/PROMPTS-DESIGN.md and do Part H only. Stop where it says to stop.`

1. **Check every screen against WCAG 2.2 AA**, including:
   - reflow at 320 px (1.4.10)
   - non-text contrast (1.4.11)
   - text spacing (1.4.12)
   - focus not hidden under sticky bars (2.4.11)
   - a non-drag alternative for every drag (2.5.7)
   - target size (2.5.8)
   - redundant entry (3.3.7)
   - accessible sign-in (3.3.8)
2. **Manual runs** of the core tasks with VoiceOver on iPhone and TalkBack on Android, plus keyboard-only on desktop.
3. **Focus management** on route changes, dialogs and sheets. Live announcements for toasts and background updates.
4. **Settings checks:** reduced motion, and a basic forced-colours check on Windows.
5. **Output:** `docs/design/accessibility.md` with results and fixes.

---

## Part I: Feel (speed, motion, feedback)

**Start Muse with:** `Read docs/PROMPTS-DESIGN.md and do Part I only. Stop where it says to stop.`

1. **Every tap shows a response within 100 ms:** a pressed state, or a spinner inside the button that keeps its label.
2. **Optimistic updates** for safe actions only (mark done, snooze), with rollback on failure and an Undo toast. Never optimistic for money or for anything sent to customers.
3. **Loading:** skeletons for loads longer than 300 ms, no full-screen spinners, and no layout shift (reserve space).
4. **Motion:**
   - Sheets rise from the bottom, and pages push on phones, over 150 to 250 ms.
   - Respect reduced motion.
   - Nothing animates on page load.
5. **Forms:**
   - Correct input types and autocomplete values (name, tel, email, street-address, postal-code).
   - Decimal keyboard for money, and "next" and "done" on the keyboard's enter key.
   - No autofocus on phones.
   - Values are kept when there's an error, long forms such as quotes save drafts automatically, and paste is always allowed.
6. **Lists:** pull to refresh where it helps (schedule, action board), "Load more" for long lists, and the scroll position is kept when going back.
7. **Speed budgets** on a mid-range Android phone on 4G: LCP under 2.5 s, INP under 200 ms, CLS under 0.1. Measure in Lighthouse and on a real device, and fail CI on regressions.
8. **Installed-app polish:** app icon, splash screen, theme colour for light and dark, standalone display, safe areas. Don't rely on vibration: iPhone web apps can't trigger haptics.

---

## Part J: Proof

**Start Muse with:** `Read docs/PROMPTS-DESIGN.md and do Part J only. Stop where it says to stop.`

1. **Visual regression in CI.** Playwright screenshots of every screen across its key states, in light and dark, English and French, at 390 px and 1440 px. Any visual change needs my approval.
2. **Design lint in CI.** It fails on:
   - raw colours or spacing outside the tokens
   - inputs under 16 px on phones
   - icon buttons without accessible names
   - images without alt text
   - dashes, middle dots, spaced hyphens or exclamation marks in strings
   - all-caps strings, and text-transform uppercase
3. **Part A's consistency suite** runs on every push.
4. **Heuristic review.** Score every screen against Nielsen Norman Group's 10 usability heuristics (severity 0 to 4) with screenshots. Fix everything at severity 3 or 4.
5. **Usability test kit for me** in `docs/design/usability-test.md`:
   - a recruiting message: 5 tradespeople, a mix of iPhone and Android, at least one French speaker
   - 5 tasks with clear success criteria
   - a think-aloud script
   - the SUS questionnaire in English and French
   - a results template covering success, time, errors, quotes and SUS score
   After I run the test, turn the results into fixes.
6. **Final scorecard** in `docs/design/scorecard.md`, measured against the bar at the top of this file. Nothing is done until every line has evidence.

---

## Sources (for you)

- iOS 27 Liquid Glass transparency slider: https://www.bgr.com/2191219/ios-27-liquid-glass-fix-customization/
- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Nielsen Norman Group, 10 usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
