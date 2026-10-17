# EveryJob (Kivo): module prompts for after UAT

## Read this part yourself (not for Muse)

**Tonight and tomorrow: no new features.** Freeze the build for UAT, fix only blockers testers hit, and write down every tester comment word for word. Module 0 turns those notes into the build order.

**The honest picture.** This module list is Jobber's Sept 23 to 25, 2026 launch, almost item for item: Teammate (morning briefing, Action Board, routines, draft quotes), Projects, Crew Scheduling, Bookkeeping, Custom Report Builder, phone calls, Marketing Suite updates, and ChatGPT and Claude connectors. [Certain, sources at the bottom] Copying a competitor's roadmap two weeks after they announced it means competing where they're strongest. Build the pieces that make your own product better (action board, briefing, quote drafts, reports), and let UAT decide the rest. [Likely]

**Verdicts, in the order I'd build them**
1. **Module 0, post-UAT triage:** always first. One session, no code. [Likely]
2. **Module 2, Action board:** build. It's the shared "what needs attention" engine that Modules 1, 4 and 11 reuse. No AI needed, $0. [Likely]
3. **Module 1, Morning briefing:** build. It's a delivery channel for the action board, so it comes after it, not before. [Likely]
4. **Module 4, Auto-drafted quotes:** build, once a price book exists. The AI picks line items; the server does all the math. [Likely]
5. **Module 5, Report builder:** reshape. Fixed reports first, then "describe a report" mapped onto an approved list of metrics. The AI never writes database queries, because that's how one business's data ends up in another's report. [Likely]
6. **Module 11, MCP connector:** read-only first, and only if testers actually use ChatGPT or Claude for work. Jobber launched theirs on Sept 25, so this is catching up, not an edge. [Certain about Jobber, Guessing about your testers]
7. **Module 3, Learning routines:** reshape into "Routines" the owner approves. Suggestions come from simple counting of what the owner keeps doing by hand, not hidden learning. [Likely]
8. **Modules 6 (Projects) and 7 (Crews):** only if UAT testers do multi-phase work or run crews. [Guessing until UAT]
9. **Module 8, Bookkeeping:** reshape into "books-ready". Jobber's version comes with a dedicated human bookkeeper who closes the books each month, which software alone can't copy. Clean categories, month-end summary, accountant access, QuickBooks sync. No ledger. [Certain about Jobber's offer, Likely on the reshape]
10. **Module 9, Phone calls:** gated. Cost spike first; the cheapest useful version is missed-call text-back. Every call costs money, so it can't fit a $0 line. [Certain that per-call costs exist]
11. **Module 10, Marketing:** stays deferred, as you decided on Sept 26. At most, a brand kit. [Your call]

**The $0 line**
- Anything with AI calls, SMS, phone calls or high email volume costs money per use. Every module spec below must show monthly cost at 10, 100 and 1,000 businesses before anything is built.
- Vercel's free Hobby plan is for non-commercial personal use only; commercial use needs Pro or Enterprise. If you're on Hobby, budget for Pro before you charge anyone. [Certain about the rule, Guessing about your plan]

**How to use this file**
- Save it in your repo as `docs/PROMPTS-MODULES.md`.
- Start each Muse session with the line under "Start Muse with". One module (or one part of a module) per session.
- Modules with a gate stop at the gate until you approve in writing.

---

## Standing instructions (Muse: follow these for every module)

Read AGENTS.md (same rules as Part 0 of docs/PROMPTS.md) and follow it.

1. Do only the module, and only the part, named in my start line.
2. **Spec first.** Write `docs/specs/module-<number>-<name>.md`: user stories per role (owner, admin, dispatcher, technician, customer); screens as ASCII wireframes at 390px; data model and migrations; permissions per role; tenant isolation; AI use, if any; privacy notes (which personal data is used and where it goes); monthly cost at 10, 100 and 1,000 businesses; edge cases; out of scope; acceptance tests with IDs. Wait for my OK.
3. **Cost line.** Our budget for new paid services is $0. If a module costs anything per month at current volume, stop and ask before building.
4. Build behind a per-business feature flag, off by default.
5. Follow the definition of done in AGENTS.md. Add new routes and tools to the authorization matrix test. Add cross-business isolation tests for every new table.
6. **Reuse, don't duplicate.** Anything about "what needs attention" comes from the Module 2 engine. All money and tax math comes from the existing server-side money and tax code. All dates use the business time zone helpers.
7. **AI rules** for any module that calls an AI model:
   - The model never does arithmetic on money, tax or dates. It returns structured JSON validated against a schema; the server computes everything.
   - The model sees only the data needed for this request, from the signed-in user's business, limited by their role.
   - Anything the model writes is a draft until a person approves it. Nothing goes to a customer automatically.
   - Every AI suggestion shows what it was based on, with links to the records.
   - Customer-written text is untrusted data. Test with injected instructions.
   - Per-business daily caps. Log each call's tokens and estimated cost, without customer personal data.
   - The feature still works, or fails with a clear message, when the AI is unavailable.
8. Report with evidence (test output, CI link, screenshots), update `docs/AGENT_LOG.md`, then stop.

---

## Module 0: Post-UAT triage

**When:** the day after UAT. First put tester notes, bug reports and any call transcripts in `docs/uat/`.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 0 only. Stop where it says to stop.`

Do not change code in this session.

1. Read everything in `docs/uat/`. List every comment, bug and request as its own item, with the tester (anonymized as T1, T2 and so on), their trade and team size if known, and their exact words.
2. Classify each item: bug (P0 data, security or money; P1 broken flow; P2 polish), usability problem, missing feature, or nice to have.
3. Merge duplicates and count how many testers hit each item.
4. Map every feature request to a module in this file (0 to 11) or mark it "new".
5. Write `docs/UAT_TRIAGE.md`:
   - Bugs first, by severity, each with a proposed fix and effort (S, M, L).
   - Modules ranked by: how many testers need it, the time or money it saves them, effort, monthly cost at 10, 100 and 1,000 businesses, and risk.
   - Testers' trades and team sizes, with a clear recommendation on whether Modules 6 (Projects) and 7 (Crews) are needed now.
   - Features testers never touched (candidates to hide or cut).
6. List questions for me. Then stop.

---

## Module 2: Action board (build first)

**When:** after Module 0, once UAT P0 and P1 bugs are fixed.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 2 only. Stop where it says to stop.`

**Goal:** one screen showing everything that needs the user's attention, each item with a one-tap next step, built on a single "attention items" engine that the dashboard, the morning briefing (Module 1), Copilot and the MCP connector (Module 11) all reuse. No AI.

**Engine**
- One server module (for example `lib/attention/`) produces attention items from rules. No other screen computes these on its own; the existing dashboard attention briefing switches to this engine.
- Each item has: a stable id (rule plus record), business_id, rule type, record type and id, title and reason as i18n keys with values (never hard-coded text), urgency (now, today, this week), age, amount where relevant, who can see it (roles and assigned users), a primary action, secondary actions, and per-user state (open, snoozed until, done).
- Starting rules, each with a business-level threshold setting and a sensible default:
  - Late jobs (start time passed, status New or Scheduled).
  - Completed jobs not invoiced.
  - Approved quotes not scheduled.
  - Draft invoices not sent after 24 hours.
  - Overdue invoices, grouped by days overdue.
  - Quotes sent with no reply after 3 days.
  - Quotes expiring in the next 3 days.
  - New leads with no response after 2 business hours.
  - Tomorrow's visits not confirmed by the customer (only if confirmations exist).
  - Failed or reversed payments, and e-Transfer matches waiting for review (only if those features exist).
  - Licence or insurance documents expiring within 30 days (only if those exist).
  - Jobs where costs exceed revenue.
- Choose between computing on read (with caching) or a table updated on change. Explain the choice. Either way, counts must never disagree with the Jobs, Quotes and Invoices lists.

**Screen**
- An "Action board" page plus a nav badge with the count of "now" items, grouped by urgency.
- Each row: what it is, why (plain words with amount and age), one primary button for the next step ("Send invoice", "Follow up", "Schedule job", "Call lead"), and a menu to snooze (tomorrow, 3 days, next week, pick a date) or mark done.
- Any action that would send something to a customer opens a pre-filled draft for review. Nothing is sent from the board without confirmation.
- Filters: all, money, schedule, leads. Search. Empty state: "Nothing needs you right now", with a link to the schedule.
- Technicians see only items about their own visits and never money. Dispatchers see schedule and lead items. Owners and admins see everything.
- The dashboard's attention card shows the top 5 items from the same engine, with "See all".

**Tests**
- Every rule with a fixed clock in America/Toronto, America/Vancouver and America/St_Johns, including the daylight saving change on Nov 1, 2026.
- Consistency: on seeded data, action board counts match the Jobs, Quotes and Invoices lists exactly.
- Role visibility, snooze and done saved per user, cross-business isolation, and performance with 10,000 jobs (indexed queries, fast load on a phone).

**Cost:** $0.

---

## Module 1: Morning briefing digest

**When:** after Module 2 is merged.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 1, Part A only. Stop where it says to stop.`

**Goal:** a short summary at the start of each user's day, built from the Module 2 engine plus today's schedule and yesterday's money.

**Part A: Content, in-app card and email**
- Content, role-aware, about 10 lines at most, with links into the app:
  - Today: visits in order (time, customer first name, area). Weather flag for outdoor visits only if Module 3 weather data exists.
  - Needs you: counts from the action board plus the 3 most urgent items.
  - Money (owners and admins only): payments received yesterday, overdue invoices (count and total), ready to invoice (count and total).
  - Leads: new since yesterday.
  - Technicians: their own visits only, no money.
  - Optional one-sentence AI summary, off by default. The AI writes words only; every number is inserted by the server.
- In-app: a "Morning briefing" card at the top of the dashboard each day until dismissed.
- Email: sent at the user's chosen local time (default 6:30 a.m. in the business time zone, weekdays), in the user's language. Keep sensitive details out of email: no phone numbers, full addresses or payment details. Counts, totals, first names and areas are fine; everything else stays behind login.
- Settings per user: on or off, time, days, channels, language. A one-click unsubscribe link in every email that turns the email channel off. The email identifies EveryJob and links to these settings.
- Scheduling: one job every 15 minutes picks users whose local send time has arrived and who haven't received today's briefing. Store a unique (user, local date) record so retries never send twice.
- Before building the scheduler, check our hosting plan's limits on scheduled jobs (how often, how precise) and list the options with costs: hosting cron, a database scheduler such as pg_cron, or a free external scheduler. Stop for my choice.
- Email volume must stay within the provider's free tier at current usage. Show the numbers.

**Part B: Push notifications (separate session)**
- Web push for the installed app. On iPhone, web push works only after the user adds the app to the Home Screen; verify the current iOS behaviour and explain it plainly in settings.
- Ask for permission only after the user turns push on, never on first visit.

**Tests:** send times in Toronto, Vancouver, Regina and St. John's; the Nov 1, 2026 daylight saving change; no duplicates on retry; role filtering; email renders in English and French on mobile; unsubscribe works; content matches the action board; a test asserts no phone numbers, full addresses or payment details appear in email bodies.

---

## Module 4: Auto-drafted quotes

**When:** after Modules 2 and 1, and only once a price book exists (Prompt 5, F6). If there's no price book yet, build that first.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 4 only. Stop where it says to stop.`

**Goal:** Copilot drafts a quote from a request, the customer's history, and the business's own past quotes and price book. The owner reviews, edits and sends it through the normal flow. Copilot never sends.

**Inputs** (this business only, only what's needed)
- The request or lead text; this customer's and property's past jobs and quotes; the 10 most similar past quotes from this business (same service type); the price book; quote templates; photos only if the AI provider supports images within the cost cap.

**How the draft is made**
- The model returns JSON validated against a schema: line items referencing price book item IDs with quantities; optional items; custom items (with a reason, and a suggested price only when nothing in the price book fits); assumptions; questions to ask the customer; and the IDs of past quotes and jobs it used.
- The server checks every ID belongs to this business, applies current price book prices (the model never sets prices for catalog items), computes taxes with the tax engine using the place of supply, and computes totals. The model never does money arithmetic.
- Guardrails: flag custom prices outside this business's historical range for that service; flag margin below the business's target; cap the number of lines; never add services the business doesn't offer; discounts only through a discount rule the owner set.
- The result is a Draft quote with a "Why this draft" panel: past quotes used, assumptions, flags.

**Screens:** a "Draft with Copilot" button on requests, leads and new quotes. Loading state, the draft, the why panel, and buttons to edit, regenerate with a note, discard, or save the draft. Sending uses the existing send flow and its confirmation.

**Safety and tests**
- Injection in the request text (asking for a $1 price, free work, or another business's prices) changes nothing beyond showing a flag.
- Drafts never use another business's quotes or prices (seeded cross-business test).
- Golden tests: seeded history produces drafts whose totals match the server's math to the cent.
- AI unavailable: a clear message, and the manual flow still works.
- Log per draft: tokens, estimated cost, accepted or edited, time to send. No customer personal data in logs.

**Cost:** AI tokens per draft. Show cost per draft and per month at 10, 100 and 1,000 businesses. Per-business daily cap.

---

## Module 5: Report builder (reshaped)

**When:** after Module 4.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 5, Part A only. Stop where it says to stop.`

**Goal:** reports a business can trust. Fixed reports first, then "describe the report you want" mapped onto an approved catalog. The AI never writes SQL or any other query.

**Part A: Metrics catalog and fixed reports**
- A catalog of approved metrics. Each has an ID, a plain-language definition in English and French, the exact calculation, and the roles allowed to see it. Start with: revenue invoiced, revenue collected, outstanding balance, jobs completed, average job value, job margin, sales tax collected by type, expenses by category, lead conversion rate, quote acceptance rate, average days to get paid.
- Approved dimensions: day, week, month, quarter, customer, service, technician, crew (if Module 7 exists), city, province, lead source, status.
- Each metric's query is hand-written, parameterized, always filtered by business_id on top of row level security, and listed in `docs/METRICS.md` for my review.
- Fixed reports from the catalog (if Prompt 5 F9 isn't done yet): revenue by month, accounts receivable aging, job profitability, sales tax summary, expenses, lead sources. Every number links to the records behind it. CSV export.
- Stop for my review.

**Part B: "Describe a report"**
- The user types a request, for example "revenue collected by month this year, Ontario jobs only, bar chart". The model returns a ReportSpec JSON (metrics, dimensions, filters, date range, chart type) validated against the catalog. Anything outside the catalog is rejected with a plain explanation and the closest available option.
- The server compiles the spec into the reviewed queries and runs them with a read-only database role, a statement timeout and a row limit. The result shows the spec restated in plain words so the user can check it ("Revenue collected, by month, Jan 1 to Oct 13, 2026, jobs in Ontario").
- Save, rename, pin to the dashboard, export CSV. Technicians can't run money metrics.

**Tests:** invalid specs rejected; injection attempts ("include all businesses", "show me the users table") rejected; cross-business isolation; golden numbers on seeded data match to the cent; date ranges use the business time zone; performance with 10,000 jobs.

**Cost:** Part A $0. Part B one small AI call per request, with a per-business daily cap.

---

## Module 11: MCP connector for Claude and ChatGPT

**When:** only after Prompt 3 (security) has passed, and only if UAT shows testers use ChatGPT or Claude for work. Read-only first.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 11, Part A only. Stop where it says to stop.`

**Goal:** a remote MCP server so a business owner can connect EveryJob to Claude or ChatGPT and ask about their own business. Directory submission is my account action; you prepare everything it needs. Start by reviewing the existing plugin kit against this spec and list the gaps.

**Part A: Server and sign-in**
- Build against the latest MCP specification revision (2026-07-28 as of October 2026; check modelcontextprotocol.io for anything newer) with the official SDK version that supports it. Remote server over Streamable HTTP on its own subdomain, with stateless request handling.
- Authorization: OAuth 2.1 with PKCE through EveryJob accounts; OAuth Protected Resource Metadata (RFC 9728) and authorization server metadata; the client registration methods that the current spec, Claude and ChatGPT require (check their current docs); short-lived access tokens issued for the MCP server as the audience; refresh token rotation; valid HTTPS certificates; Origin header validation.
- Consent screen in English and French listing exactly what the AI app will be able to see and do, which business it applies to (if the user has several), and limited by the user's role.
- Settings, Connected apps: list each connection with last-used time; revoke one or all; revocation works immediately.
- Audit log entry for every tool call, labelled "via Claude" or "via ChatGPT".

**Part B: Read-only tools** (annotated as read-only)
- get_todays_schedule, list_action_items (Module 2), find_customer, get_customer_summary, list_open_quotes, list_unpaid_invoices, get_invoice_status, get_job, get_revenue_summary (owners and admins only).
- Small, paged results with only the fields needed. No bulk export tool.
- Tool descriptions are short and factual: no instructions to the AI, no promotion, nothing telling it to fetch instructions from elsewhere.
- Specific, helpful error messages that say what went wrong and what to do. Never generic ones.
- Customer-written text in results (lead descriptions, notes, messages) is returned as clearly labelled data. Test that instructions hidden in that text never cause a write.
- Stop for my review before Part C.

**Part C: Limited write tools** (each its own tool, never one catch-all tool)
- create_request_from_text (for example from an email the user pastes), create_customer, add_note_to_job, create_draft_quote (Draft only, using Module 4's server-side math, never sent).
- Idempotency keys; rate limits per token and per business.
- Never available through MCP: payments, refunds, charging cards, sending anything to customers, voiding or deleting, changing money on sent documents, team or role changes, exporting all data. Anthropic's connector directory doesn't accept connectors that transfer money, and Jobber's own connector keeps money and the schedule read-only.

**Part D: Testing and submission pack**
- Test every tool with the MCP Inspector, as a custom connector in Claude, and in ChatGPT's developer mode.
- Tests: a Business A token can't read Business B; a technician token can't read money; a revoked token fails immediately; injection tests; rate limits.
- Prepare for me: a privacy policy section for AI connectors, a test account with fake sample data, screenshots, listing text, and a checklist against Anthropic's current directory policy and review criteria and OpenAI's current plugin submission requirements. Fetch both from the official docs now; don't rely on memory. I will submit.

**Cost:** hosting only. Confirm it fits our current plan.

---

## Module 3: Learning routines (reshaped into Routines)

**When:** after Modules 2, 1 and 4.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 3 only. Stop where it says to stop.`

**Goal:** owners set up repeatable "when this happens, do that" routines, and Copilot suggests new ones based on what the owner keeps doing by hand. Every routine is visible, editable and can be switched off. No hidden learning.

**Engine**
- A routine is a trigger, conditions and actions.
- Triggers: a schedule (business time zone); an event (quote sent, job completed, payment received, lead created, visit tomorrow); or a weather forecast for outdoor jobs, using free open data from Environment and Climate Change Canada (check the licence and attribution terms).
- In version 1, actions only create drafts or action board items: draft a follow-up, draft an invoice, draft a reschedule message, create a task or reminder. Nothing reaches a customer without the owner's confirmation. Auto-send for specific low-risk messages can come later, per routine, with explicit opt-in and the anti-spam rules in AGENTS.md.
- Every run has an idempotency key so a routine never fires twice for the same thing. Run history with outcomes is visible to the owner.
- Starter templates: rain delay for tomorrow's outdoor jobs; Friday afternoon "invoice everything completed this week"; quote follow-up after 3 days; materials reminder 2 days before jobs using selected price book items.

**Suggestions (the "learning")**
- A pattern detector based on counting, not machine learning. Example: the owner sent a follow-up about 3 days after 8 of their last 10 quotes. Copilot then suggests a routine and shows that evidence. Accept, edit or dismiss; a dismissed suggestion doesn't return for 90 days.
- A "Copilot preferences" page shows everything Copilot has learned or been told (tone, default payment terms, usual arrival window and so on). The owner can edit or delete any of it.
- Learn only from the business's own actions. Never build profiles of customers. Keep a person in the loop for anything that affects a customer, which also keeps us clear of Quebec's rules on decisions made only by automated processing (owner to verify).

**Tests:** triggers across time zones and the daylight saving change; no duplicate runs; weather trigger with mocked data; disabled routines never run; suggestion thresholds; isolation; a test asserting routines only create drafts and never send.

**Cost:** mostly $0 (rules and counting). AI only when drafting text, with a per-business cap.

---

## Module 6: Projects

**Gate:** build only if Module 0 shows testers doing multi-phase work (renovations, multi-week installs).

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 6 only. Stop where it says to stop.`

**Goal:** a container above jobs for multi-phase work: phases, tasks, visits, change orders and progress billing, with progress that updates itself.

**Data**
- projects: business_id, customer, property, name, status (planned, active, on hold, completed, cancelled), target start and end, contract value in cents, billing method (milestones or progress percentage), notes.
- phases (milestones): order, name, target date, billing amount or percentage, status.
- tasks: title, phase, assignee (a person, or a crew if Module 7 exists), due date, checklist, status, linked visit.
- Jobs and visits can belong to a project and phase. Change orders (Prompt 5, C4) attach to a project and change the contract value once the customer approves.
- Holdback option: a configurable percentage held back from progress invoices and released at completion. Mark it "owner to verify the rules for each province" and keep it off until I confirm.

**Money**
- Deposits, milestone or progress invoices, approved change orders and holdback release add up exactly to the contract value. Tests prove it to the cent.
- Budget vs actual: costs from expenses and tracked time.

**Screens**
- Project list: status, next milestone, percent complete, invoiced vs contract.
- Project detail: phases in order with their tasks and visits, money summary, photos and documents, activity history.
- Optional progress page in the customer portal, off by default.
- New action board rules: milestone due, task overdue, milestone done but not invoiced.

**Permissions:** technicians see their tasks and visits, never money.

**Tests:** billing math, status rules, progress calculation, isolation, permissions, and a 200-task project that stays fast on a phone.

---

## Module 7: Crews

**Gate:** build only if Module 0 shows testers with two or more people working together.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 7 only. Stop where it says to stop.`

**Goal:** organize employees and subcontractors into crews and assign a crew to a visit, instead of scheduling people one at a time.

**Data**
- crews: name, colour, lead, members, skills or tags, active.
- Members can be employees or subcontractors. Subcontractor records: business name, contact, rate, and optionally WSIB clearance number and expiry (Ontario) and insurance certificate and expiry.
- Availability: working hours, time off, one-off exceptions.

**Scheduling**
- Assign a crew, or individuals, to a visit. Warn on conflicts: crew double-booked, a member on time off, a member in two places at once.
- Capacity view by day: hours booked vs available per crew.
- Drag and drop on desktop; a "crew day" view on the phone for the lead, with visits in order.
- Notify members when assigned or changed (in-app and email; SMS only if I approve the cost).

**Time and cost**
- Clock in and out per member per visit. The lead can clock the crew in; each member confirms their own time.
- Labour cost per visit from member rates times time, feeding job costing and project budgets.

**Permissions:** leads see their crew's visits. Subcontractors see only their assigned visits and only the customer details the job needs.

**Tests:** conflict detection, time zones, costing math, permissions, isolation.

---

## Module 8: Books-ready (reshaped from bookkeeping)

**When:** after the modules above that UAT confirmed.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 8 only. Stop where it says to stop.`

**Goal:** make the business's financial data clean enough that an accountant or bookkeeper can close the month quickly, and sync it to their accounting software. Do not build a general ledger, bank feeds or tax filing.

**Build**
- Categories: every invoice line, payment, refund, credit note and expense has an accounting category. Provide a default list mapped to the CRA's T2125 expense lines for sole proprietors (verify current line numbers with the CRA), editable by the business.
- Expenses record tax paid by type (GST/HST, QST, PST). Supplier invoices (bills) record due dates.
- Month-end summary: income invoiced vs received, expenses by category, sales tax collected and paid, receivables, unpaid bills.
- Close checklist: every expense has a receipt, every payment is matched, no draft invoices older than 7 days, nothing uncategorized. When the owner marks a month as reviewed, that month's financial records lock. Unlocking needs the owner and goes in the audit log.
- Accountant access: invite an accountant with a read-only financial role. Export package per period (CSVs plus a zip of receipts).
- Accounting sync: QuickBooks Online first (develop against its sandbox), then Xero. Mapping screen, error log, retry, and never silently overwrite data in either system.
- A clear note in the app: this prepares the books; it doesn't replace an accountant or file taxes.

**Tests:** period totals match the underlying records to the cent; lock and unlock behaviour; the accountant role can't change anything; export contents; sync idempotency in the QuickBooks sandbox.

**Cost:** $0 apart from build time. Check the accounting providers' developer terms.

---

## Module 9: Phone calls and AI receptionist

**Gate:** Part A only, then stop. Parts B and C need my written approval and a budget. Jobber already sells this as an add-on, so it's catching up, not an edge.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 9, Part A only. Stop where it says to stop.`

**Part A: Cost and compliance spike (no code)**

Write `docs/specs/phone-spike.md`:
- Monthly cost at 10, 100 and 1,000 businesses, assuming 50 and 200 calls per business per month at 3 minutes each: phone numbers, inbound minutes, speech-to-text, AI model, text-to-speech, SMS. Compare at least two telephony providers that offer Canadian numbers, including where they store data.
- Compliance notes for my lawyer: inbound calls only (no automated outbound calling); tell callers at the start that they're talking to an automated assistant and, if calls are recorded, that the call is recorded and why; consent and retention under PIPEDA and Quebec's Law 25; English and French; how long recordings and transcripts are kept.
- Safety: never give safety advice. For emergencies (gas smell, flooding near electrical, fire), tell the caller to get to safety and call 911 or their utility, then alert the owner immediately.
- Failure plan: if the AI or the provider fails, fall back to voicemail and a text to the owner.
- Stop.

**Part B (only if approved): Missed-call text-back**
- The business forwards unanswered calls to its EveryJob number. The caller gets a text with the business name, a booking link and a short request form. A lead is created and the owner notified.
- Owner to verify that texting someone back after they called counts as responding to their inquiry under CASL.

**Part C (only if approved): AI voice receptionist**
- Answers in English or French; collects name, service address, what's needed, urgency and preferred times; checks availability (read-only) and creates a request or tentative booking for approval; reads the details back; sends a confirmation text; attaches a transcript and summary to the lead; hands off to a person on request; never quotes prices unless the business turns on price ranges from the price book.
- Per-call time limit and per-business monthly minute cap, with usage visible to the owner.
- Security: verify the telephony provider's webhook signatures; don't treat caller ID as proof of identity; resist spoken injection attempts; protect against spam calls; recordings encrypted, private and deleted on schedule.
- Tests: scripted call simulations in both languages, emergency phrases, injection attempts, cap enforcement, provider outage.

---

## Module 10: Marketing and brand

**Gate:** marketing automation stays deferred (owner decision, Sept 26). Only Part A may be built without reopening that decision.

**Start Muse with:** `Read docs/PROMPTS-MODULES.md and do Module 10, Part A only. Stop where it says to stop.`

**Part A: Brand kit (not marketing automation)**
- Logo, colours, typeface choice and tagline, applied to PDFs, emails, the customer portal and the booking page, with a contrast check and a live preview.
- No AI-generated logos (trademark and quality risk). The business uploads its own.

**Part B (only if I reopen marketing in writing): Referrals**
- Each customer gets a referral link; bookings through it are tagged; rewards are tracked manually.

**Part C (only if I reopen marketing in writing): Campaigns**
- Segments of past customers (service, last job date, city). Seasonal templates in English and French.
- Send only to customers with valid CASL consent (express consent, or implied consent still within its time limit), with identification and a working unsubscribe in every message. Never imported or purchased lists.
- Sending limits, preview, test send, results.
- Email beyond the free tier and every SMS cost money. Show the monthly cost before building.

---

## Sources (for you)

- Jobber Teammate and the rest of the launch: https://www.prolandscapermagazine.com/us/2026/10/07/jobber-launches-ai-powered-teammate-and-expands-platform-for-service-businesses/
- Jobber Now 2026 page (Projects, Bookkeeping with a dedicated bookkeeper, AI connectors): https://www.getjobber.com/events/jobber-now-2026/
- Jobber press release (Teammate, Crew Scheduling, Bookkeeping): https://www.morningstar.com/news/pr-newswire/20260923ca54068/jobber-unveils-jobber-teammate-the-first-ai-agent-for-home-and-commercial-service-businesses-to-plan-act-and-learn-like-a-real-team-member
- Jobber MCP launch (Sept 25, 2026): https://www.prnewswire.com/news-releases/jobber-launches-mcp-bringing-home-and-commercial-service-data-and-workflows-directly-into-chatgpt-and-claude-302890385.html
- What Jobber's ChatGPT plugin can and can't change (third-party review): https://www.usecarly.com/blog/chatgpt-jobber-integration/
- Vercel commercial use rule: https://vercel.com/docs/limits/fair-use-guidelines
- MCP authorization spec (2026-07-28): https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- Anthropic connector review criteria: https://claude.com/docs/connectors/building/review-criteria
- Anthropic MCP directory policy: https://support.claude.com/en/articles/11697096-anthropic-mcp-directory-policy
- Anthropic connector submission: https://claude.com/docs/connectors/building/submission
