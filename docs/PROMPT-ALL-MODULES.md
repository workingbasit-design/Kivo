# EveryJob (Kivo): redesign every module

This replaces Part E of `docs/PROMPTS-DESIGN.md`. The Today screen in the app mockup is the same design as the dashboard mockup, so `docs/PROMPT-DASHBOARD.md` still applies to it.

## Read this part yourself (not for Muse)

### What your Jobs and Schedule screenshots show

1. **The app is half in dark mode.** The frame went dark, but the cards, search box, filter chips and the late-jobs banner stayed light. [Certain] The usual cause is components with hard-coded colours instead of shared colour settings (tokens). [Likely] Redesigning screens one at a time won't fix that. One set of tokens used by every component will.
2. **The main action almost disappears.** "New job" and "Schedule new job" are dark buttons on a dark page. [Certain]
3. **The grey glossy ⋮ ball** next to "New job" doesn't match anything else in the app. [Certain]
4. **Schedule buries the week.** Four late jobs push the week below the fold. The banner says to reschedule or complete them, but the rows have no buttons. [Certain]
5. **"General Service" shows both "In progress" and "Late".** The rule we set was Late only for jobs that haven't started. [Certain it's shown, Likely a rule mismatch]
6. **The two cleaning jobs now read Sep 29 and Oct 6 on every screen.** When you first showed me the Jobs list, they were Sep 30 and Oct 7. The screens now agree, but they may agree on the wrong date. Check what you originally entered. [Certain the dates changed, Guessing which is right]
7. **The Today tab icon looks like a settings gear** at that size. [Likely]
8. **The week label is "Oct 12 - Oct 18 2026".** That's a spaced hyphen used as a dash, and there's no comma before the year. [Certain]
9. **"10:00 AM, Tue, Sep 29" reads backwards.** Date first is easier: "Tue, Sep 29, 10:00 a.m." [Likely]

### What the app mockup is
- **Every module** on one shared kit, 20 screens in all:
  - Today, Schedule, Jobs, Job detail
  - Money, Invoice, New quote
  - More, Customers, Customer detail, Leads, Expenses, Projects, Equipment, Settings
  - Copilot, Notifications
  - Public profile, Quote approval, Invoice payment (what customers see)
- **Light and dark mode.** Switch in Settings, Appearance.
- **Numbers agree across screens**, and the links between screens work.
- **It's a reference, not app code.** Everything in it is sample data.

### How to use it
- Save the code as `docs/design/app-mockup.html` and this file as `docs/PROMPT-ALL-MODULES.md`.
- Run the parts in order, one per session. Part 1 matters most: once every component uses the same tokens, dark mode and consistency fix themselves everywhere.

---

## Muse: standing rules for this file

Read AGENTS.md and the standing design rules in `docs/PROMPTS-DESIGN.md`, and follow them.

- **Design reference.** Use `docs/design/app-mockup.html`. Open it in a browser at 390 px wide, and switch light and dark in Settings, Appearance.
- **Match it closely.** Copy the layout, spacing, colours, type and icons, but rebuild everything with the app's own components and real data. Never paste the mockup's HTML, sample numbers or demo messages into the app.
- **One source of truth.** Every number on a screen comes from the same query functions the other screens use.
- **Screenshots for every change:** before and after, at 390 px and 430 px, light and dark, English and French.

---

## Part 1: The kit (do this first)

**Start Muse with:** `Read docs/PROMPT-ALL-MODULES.md and do Part 1 only. Stop where it says to stop.`

1. **Tokens.** Copy the colour tokens from the mockup exactly: the light `:root` block and the dark blocks. Add type (Barlow for text, Barlow Condensed with tabular figures for numbers), spacing, radius and elevation tokens.
2. **No hard-coded colours.**
   - Remove every hard-coded colour from components and pages.
   - Add a CI check that fails on any hex, rgb or hsl colour outside the tokens file.
3. **Dark mode.**
   - It follows the phone's setting by default.
   - Settings, Appearance lets the user choose System, Light or Dark, saved per user.
   - Add a test that loads every screen in dark mode and fails if any card, input, chip, banner or sheet has a background that isn't a dark token.
4. **Components.** Build each one to match the mockup:
   - **Navigation:** top bar (brand on main screens, back button with the previous screen's name on sub-screens); tab bar with Phosphor duotone icons (Today uses the outlined sun, not a filled one that looks like a gear).
   - **Page structure:** page header with one hi-vis primary action; group headings.
   - **Finding things:** search field; filter chips with counts, scrolling sideways with a fade at the edge; segmented control.
   - **Lists:** list rows (icon or avatar, title, subtitle, badges, amount on the right); status badges (late, warning, done, scheduled, info).
   - **Cards and content:** banners (warning, info); cards; key-value rows; contact buttons (call, text, email, map); progress steps; line items with subtotal, HST and total; photo tiles; margin bar; summary cards; avatars.
   - **Actions and feedback:** a sticky action bar (detail screens hide the tab bar); bottom sheets; a toast with undo; empty states; loading skeletons.
   - **Screen-specific:** week strip; agenda rows; lead cards; project cards; chat bubbles and the Copilot action card.
   - **Customer-facing:** page header with the business brand; payment method choices.
5. **A `/design` page** showing every component in every state, in light and dark.

Then stop.

---

## Part 2: Screen patterns

**Start Muse with:** `Read docs/PROMPT-ALL-MODULES.md and do Part 2 only. Stop where it says to stop.`

Build five layout patterns so every screen in the app is one of them:

1. **List screen.**
   - Header with the primary action, search, and filter chips whose counts always match the list.
   - A grouped list.
   - An empty state for each filter.
2. **Detail screen.**
   - Back button, icon, title and status badges.
   - Cards in a fixed order: when and where, who, what's next, money, notes and photos, history.
   - A sticky action bar whose primary button is the one next step.
3. **Builder screen** (quote, invoice, job form).
   - Line items, add from price book, optional items, terms.
   - A live total in the sticky bar, and a preview of what the customer sees.
4. **Hub screen** (Money). Segmented views, with "To do" first.
5. **Customer-facing page.**
   - The business's brand and a language switch.
   - A clear total and one primary action.
   - "Powered by EveryJob" at the bottom.

Then stop.

---

## Part 3: Screens, in this order (one per session)

**Start Muse with:** `Read docs/PROMPT-ALL-MODULES.md and do Part 3, screen group 1 only. Stop where it says to stop.` Then group 2, 3, and so on.

1. **Jobs and Job detail.**
   - Filters: All, Late, Today, Upcoming, To invoice. Groups: Late, Today, Tomorrow, Later, Earlier this week.
   - **Late** means not started and the start time has passed. A job in progress is never "Late". If it runs past its end time, show "Running over".
   - Job detail actions follow the status: Assign, Start, Complete, Invoice.
2. **Schedule.**
   - The week strip comes first.
   - Late jobs are one compact banner. Its Review button opens Jobs, filtered to Late.
   - Below that: the selected day's agenda with crew chips, and "Add a visit" for that day. Tapping a day changes the agenda.
3. **Money.**
   - The hub: To do, Invoices, Quotes, Payments.
   - Invoice detail, with a Record payment sheet: amount no more than the balance, method, reference.
   - The New quote builder: price book, optional items, deposit, valid-until date, tax from the service address, and the Ontario 10% notice.
   - "Remind" and "Invoice all" create drafts only.
4. **Customers and Customer detail.**
   - Contact buttons.
   - Lifetime value, number of jobs, average days to pay.
   - Property notes and history.
   - A banner when something needs invoicing.
5. **Leads.** Cards with the message, source, how long it's been waiting, and Quote, Call and Decline. Show the average first reply time.
6. **More and the rest.**
   - More menu.
   - Settings, with a working Appearance switch.
   - Expenses: spent and tax paid, with a "Needs a job" filter.
   - Projects: phase progress, contract vs invoiced.
   - Equipment: service due dates.
7. **Copilot and Notifications.**
   - Copilot answers from records and shows its sources, with action cards. Nothing is sent without approval.
   - Notifications have read and unread states.
8. **Customer-facing pages.**
   - **Public profile** with booking.
   - **Quote approval:** typed name, consent checkbox and deposit. Optional add-ons update the total. Show the 10% notice.
   - **Invoice payment:** Pay by bank first, then card, then e-Transfer instructions with the reference code.
9. **Today.** Already specified in `docs/PROMPT-DASHBOARD.md`. Make sure it uses the kit.

---

## Part 4: Fix these from the owner's screenshots

**Start Muse with:** `Read docs/PROMPT-ALL-MODULES.md and do Part 4 only. Stop where it says to stop.`

1. **Partial dark mode.** Cards, the search field, filter chips and banners stay light in dark mode. Part 1 fixes the cause. Confirm with the dark-mode test.
2. **Invisible primary actions.** "New job" and "Schedule new job" are dark on dark. Use the one hi-vis primary style.
3. **The glossy grey ⋮ ball.** Replace it with a standard icon button, or move its actions into the "Sort" or overflow menu.
4. **Schedule order.** Week first, and late jobs as one compact banner.
5. **"Late" on in-progress jobs.** Apply the Late rule from Part 3, group 1.
6. **Date check.**
   - Create a test job for Wed, Oct 7 at 10:00 a.m. Toronto time. Save it, reload, and confirm every screen shows Wed, Oct 7, 10:00 a.m.
   - Then show me the two existing cleaning jobs. On Oct 13 they appeared as Sep 30 and Oct 7, and now they show as Sep 29 and Oct 6.
   - If an earlier fix shifted them, propose a one-time correction and wait for my OK.
7. **Today tab icon.** Use the outlined duotone sun.
8. **Week label.** Write it as "Oct 12 to 18, 2026", with no dashes.
9. **Date and time order.** Use "Tue, Sep 29, 10:00 a.m." everywhere, through the shared formatter.

Then stop.

---

## Part 5: Proof

**Start Muse with:** `Read docs/PROMPT-ALL-MODULES.md and do Part 5 only. Stop where it says to stop.`

1. Show screenshots of every screen side by side with the mockup: light and dark, at 390 px, English and French.
2. Make sure all the checks pass, with CI green:
   - the dark-mode token test
   - the design lint
   - the consistency tests
   - accessibility checks (axe)
3. Report every difference from the mockup and why. Then stop.
