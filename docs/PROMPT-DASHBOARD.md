# EveryJob (Kivo): rebuild the dashboard

This replaces Part E1 in `docs/PROMPTS-DESIGN.md`.

## Read this part yourself (not for Muse)

**Why it went thin.** There are two reasons.

- Part E1 told Muse to hide numbers that had no data. Your test business has a few jobs and $100 of revenue, so almost everything got hidden. That instruction was wrong for a dashboard, and this file replaces it.
- A dashboard can't be judged on almost-empty data. Part 0 below creates a realistic demo business, so you, Muse and your UAT testers see what a real week looks like.

**Two bugs in your screenshots:**
- "Today's schedule" lists a job dated Oct 18, while the briefing above calls the same job "Tomorrow".
- "1 jobs ready to bill" should say "1 job".

**The mockup.** Open the dashboard mockup on your phone. Screenshot each section and attach the screenshots to the Muse session along with this file. Muse can't open the link itself.

**Visual direction ("hi-vis").** Your lime is the colour of the safety vests people wear on job sites. Lime appears in four places only: the main action, the active tab, the money bars, and the "now" marker. Everything else stays neutral, so lime always means "look here". This is a proposal; change it if it isn't you.

**Fonts.** Barlow, a typeface based on road and licence-plate signage.

**Icons.**
- One set: outline plus a soft fill.
- A toolbox for Jobs.
- Trade icons on each visit: broom, flame, droplet, window.
- No coloured icon tiles.

**How to run.**
- Save this file as `docs/PROMPT-DASHBOARD.md`.
- Start each Muse session with the line under "Start Muse with".
- Part 0 first, then A, B, C, D.

---

## Muse: standing rules for this file

Read AGENTS.md and the standing design rules in `docs/PROMPTS-DESIGN.md`, and follow them. The design reference is the owner's mockup screenshots plus the spec below. Match them closely. If something doesn't fit our data model or code, ask instead of improvising. Before and after screenshots at 390 px and 430 px, light and dark, English and French, are required for every part.

---

## Part 0: Demo business (do first)

**Start Muse with:** `Read docs/PROMPT-DASHBOARD.md and do Part 0 only. Stop where it says to stop.`

1. **Seed script.** It creates a separate demo business, clearly labelled "Demo" everywhere in the UI and never mixed with real data. The data is six months of history for a Toronto-area home services company:
   - four trades: cleaning, gutters, furnace and HVAC tune-ups, window washing
   - about 350 jobs
   - 3 technicians
   - about 120 customers with GTA addresses
   - quotes in every status
   - invoices with partial and late payments
   - leads with response times
   - expenses with receipts
2. **Reproducible.** Use a fixed random seed so screenshots can be repeated. Make dates relative to today, so the demo always looks current.
3. **Owner-only switch** in Settings to open the demo business, for UAT demos and design reviews.

Show me screenshots of the existing screens using demo data. Then stop.

---

## Part A: Fix these first

**Start Muse with:** `Read docs/PROMPT-DASHBOARD.md and do Part A only. Stop where it says to stop.`

1. **"Today" mismatch.** "Today's schedule" shows a job dated Oct 18 while the briefing calls it "Tomorrow".
   - Use one definition of "today", in the business time zone, everywhere.
   - Add a test at 10:47 p.m. America/Toronto, when it's already the next day in UTC.
2. **Plurals.** Every count uses plural-aware messages in English and French (Intl.PluralRules or ICU messages). French treats 0 and 1 as singular.
   - Add a test that renders every count message with 0, 1 and 2.
   - "1 jobs" must be impossible.
3. **Briefing copy.**
   - No quotation marks around job titles.
   - Title on one line, customer on the next.
   - No fragments like "For New."
   - The greeting matches the business's local time, or is removed.
4. **One date style everywhere.** "Today's schedule" says "Oct 18, 2026" while the briefing says "Tue, Sep 29". Use the shared formatter.

Then stop.

---

## Part B: Visual direction and icons

**Start Muse with:** `Read docs/PROMPT-DASHBOARD.md and do Part B only. Stop where it says to stop.`

1. **Colour tokens** (light; dark values as in the mockup):

   | Token | Hex | Use |
   |---|---|---|
   | asphalt | #1D2024 | text, the Collected panel, tab bar |
   | concrete | #F2F3EF | page background |
   | white | #FFFFFF | surfaces |
   | hi-vis | #D4F24C | main action, active tab, money bars, now marker only |
   | reflective | #C7CCD1 | the stripe motif |
   | safety orange | #E8590C, text #B54708 | needs attention |
   | signal red | #C8322B | late, overdue |
   | green | #1C7C45 | done |

   - Lime is never text on white.
   - Charts on white use asphalt plus steel #8B939B, so every bar has at least 3:1 contrast.
2. **Type.**
   - Barlow for interface text, Barlow Condensed for numbers and big figures, with tabular figures.
   - Self-host the fonts (woff2, only the weights used, font-display swap) instead of loading them from Google at runtime.
   - Confirm the licence (SIL Open Font License) and record it in `docs/LICENSES.md`.
3. **Icons.**
   - Use one icon family with an outline-plus-soft-fill style. I suggest Phosphor Icons: regular weight for inactive, duotone for status and active. Confirm the licence and import only the icons used.
   - Tab bar: Today (sun), Schedule (calendar), Jobs (toolbox), Money (wallet), More.
   - Trade icons for job types: cleaning, gutters, furnace and HVAC, windows, plumbing, electrical, landscaping, snow, painting, general handyman. Map each price book service to a trade icon, and let the owner change it.
   - Status icons always come with a word.
   - No icons inside coloured tiles.
4. **Motif.** The reflective stripe appears once, at the top of the Collected panel. Today's bar uses the stripe pattern.
5. **Tab bar.** Full width, with the active tab shown by a hi-vis pill behind the icon. Apply the new icons app-wide, not just on the dashboard.

Then stop.

---

## Part C: The dashboard, section by section

**Start Muse with:** `Read docs/PROMPT-DASHBOARD.md and do Part C only. Stop where it says to stop.`

Default order (the owner can customize it): header, quick actions, Collected, Needs you, Key numbers, Today's visits, Where your money is, Last 8 weeks, Customize.

1. **Header.**
   - The date in the business time zone ("Saturday, October 17").
   - One summary sentence built from data by a template, not by AI: "{visits} visits today, {done} done. {amount} ready to invoice." English and French, plural-aware.
2. **Quick actions.** New job (the one hi-vis primary), New quote, New invoice, Record payment.
3. **Collected.**
   - The amount collected in the period (This week or This month), in the business time zone.
   - Compare it with the same elapsed days of the previous period, not the whole previous period.
   - Bars: per day for a week, or per month for six months. Today's bar is striped and future days are dashed.
   - Footer: invoiced in the period, and jobs done out of jobs scheduled.
   - Tapping a bar opens payments for that day.
4. **Needs you.**
   - The top 4 items from the attention engine (Module 2), with a count badge and "See all".
   - Each item has one action that opens a draft or a picker. Nothing is ever sent from here.
5. **Key numbers (2 by 2).** Each tile opens its filtered list, and its number must equal that list.
   - **Owed to you:** total unpaid, the overdue amount in red, and an aging bar (current, 1 to 30, 31 to 60, over 60 days).
   - **Ready to invoice:** the amount, the number of jobs, and customer initials.
   - **Quotes waiting:** the amount, the count, and how many expire within 7 days.
   - **New leads:** how many are waiting, the average first reply this week, and the oldest waiting.
6. **Today's visits.**
   - A timeline in the business time zone. Each visit shows the time, trade icon, title, customer and area, the assigned person, and status.
   - A "now" marker.
   - Unassigned visits show an Assign button.
   - Tapping opens the visit.
7. **Where your money is.**
   - Stages, each with a count and an amount: new leads, quotes out, approved not scheduled, scheduled, done not invoiced, invoiced not paid (with the overdue part).
   - A total "in progress right now".
   - "Approved not scheduled" and "done not invoiced" are leaks. They're highlighted, with a fix button.
8. **Last 8 weeks.**
   - Collected vs invoiced per week, with the current week marked.
   - Axis labels show the day, plus the month only when it changes.
   - "Show the numbers" opens a data table for screen readers.
9. **Customize.**
   - Show, hide and reorder sections. Saved per user on the server.
   - Defaults by role:
     - Owner and admin: everything.
     - Dispatcher: no money sections.
     - Technician: a "My day" version with only their visits and tasks.

**States for every section:**
- Loading: a skeleton shaped like the section.
- Error: retry inside the section, while the rest of the page still works.
- New business: keep the structure. Show empty charts with one line such as "Your first payment will show here", and the setup checklist at the top. No wall of $0.00 and no blank page.
- Heavy demo data.

Then stop.

---

## Part D: Charts and proof

**Start Muse with:** `Read docs/PROMPT-DASHBOARD.md and do Part D only. Stop where it says to stop.`

1. **Charts.**
   - Plain SVG or CSS rather than a chart library, unless you show a library adds under 30 KB.
   - Each chart has a summary label for screen readers and a data table. Tap targets are at least 44 px. Numbers use tabular figures.
   - No animation on load. Use a short transition when switching week and month, off under reduced motion.
2. **Consistency tests.**
   - Every dashboard number equals its list: owed equals the unpaid invoices total, ready to invoice equals the done-and-uninvoiced jobs, and so on.
   - Run the tests in America/Toronto, America/Vancouver and America/St_Johns, including 11:30 p.m.
3. **Speed.** The dashboard loads with one request, or parallel requests per section, with server time under 300 ms on the demo business. Skeletons show in the meantime.
4. **Screenshots.**
   - At 390 px and 430 px, light and dark, English and French.
   - For the demo business, a brand-new business, and the technician view.
   - Shown side by side with the mockup.
5. **Report** what matches the mockup and what doesn't, and why. Then stop.
