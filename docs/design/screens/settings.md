# E7: Settings and onboarding — screen brief

## Settings

**The screen's job.** Let the owner find and change any business setting in under 10 seconds.

**Primary action.** Search settings (the fastest path to any setting). Every group also links to its detail page or anchor.

**Understand in 3 seconds.** "These are my business settings, grouped by topic. I can search."

**390px wireframe.**
- PageHeader: "Settings"
- Sticky search field ("Search settings", clear button)
- Group chips row (horizontal scroll): Business, Money, Communication, Scheduling, Team, Account, Data, Support
- Sections, each with SectionHeader + description:
  - **Business**: business profile form (name, phone, address, hours), logo, language, trade profile + credentials
  - **Money**: payments setup, tax province, Interac e-Transfer, export data
  - **Communication**: messaging, notifications, push
  - **Scheduling**: booking page, checklist templates, working hours (in business form)
  - **Team**: manage team link
  - **Account**: personal profile, Google connection, security (2FA)
  - **Data**: export
  - **Support**: support inbox, help
- Typing in search filters sections by keywords; empty state when nothing matches.
- Tokens only, sentence case, no entrance animations.

## First-run onboarding

**The screen's job.** Capture the three facts that tailor EveryJob to this business, then hand off to the tailored checklist.

**Primary action.** Answer three questions (trade, team size, province), then Continue. "Do later" always visible (standing rule: never force completion).

**Understand in 3 seconds.** "Three quick questions so the app fits my business. I can skip."

**390px wireframe.**
- Progress: "Step 1 of 3" style, or one scrolling page with three grouped questions (chosen: one page, three sections — fewer taps, works offline, no state loss between steps)
- Q1 Trade: radio list (Plumbing, Electrical, Heating & cooling, Carpentry, Painting, Landscaping, Cleaning, Renovation, Other)
- Q2 Team size: radio list (Just me, 2 to 5 people, 6 or more)
- Q3 Province: select (13 provinces/territories)
- Sticky bottom bar: "Do later" (tertiary) + "Continue" (primary, disabled until all answered)
- On submit: saves trade, teamSize, taxRegion (province), sets onboardingDone. Redirects to dashboard.

**Tailored checklist** (dashboard OnboardingChecklist):
- Base steps (everyone): add customer, create job, send quote/invoice.
- If team size is "2 to 5" or "6 or more": add "Invite your team" step.
- If province is QC: the tax section of settings is highlighted (QST number) — surfaced as a settings hint, not a checklist step (no invented step).
- Progress label uses the real step count ("2 of 4 complete"), never a hardcoded "of 6".

**Entry point.** Dashboard redirects to /onboarding when `business.onboardingDone` is false. Existing businesses with real data (jobs or customers) are backfilled to done in the migration, so only true first-runs see it. /onboarding redirects to /dashboard when already done (no loop).

## Decisions
- teamSize stored as String ('1' | '2-5' | '6+') on Business — display labels via i18n.
- Province stored in existing Business.taxRegion (already the province code; drives tax calc).
- No new dependency. Zod validation on the save action.
- Copy follows VOICE.md (plain, no exclamation marks, sentence case).
