# EveryJob 5-Hour Release Sprint Plan
**Goal:** Complete mobile-first redesign, full module testing, release-ready app with testable SMS/email
**Constraint:** $0 spend, no approvals needed, autonomous execution
**Date:** 2026-09-26

---

## Team Roles (all played by Muse)

| Role | Responsibility |
|------|---------------|
| Architect | System design, mobile-first patterns, code structure |
| BA | Requirements, user stories, acceptance criteria |
| Developer | Implementation, redesign, bug fixes |
| Tester | Full module test passes, regression, mobile testing |
| DevOps | Build, deploy, release verification |
| Market Researcher | Competitive analysis (Jobber, Housecall Pro), UX benchmarks |
| End User | Non-technical tradesperson perspective |

---

## HOUR 1: Audit & Architecture

### 1.1 Mobile UX Audit (20 min)
- Screenshot every main module at 375px viewport
- Score: thumb reach, touch targets (min 44px), readability
- Document top 10 mobile pain points

### 1.2 Market Research (15 min)
- Jobber mobile: bottom nav, job cards, quick actions
- Housecall Pro: dispatch view, customer comms flow
- Extract 5 patterns worth adopting

### 1.3 BA Requirements (15 min)
- Define "release ready" acceptance criteria per module
- Prioritize: P0 (blocks release), P1 (should fix), P2 (nice to have)
- 5 end-user tasks completable unaided

### 1.4 Architecture Decisions (10 min)
- Bottom-tab nav for mobile (5 tabs max)
- Card layouts over tables on mobile
- FAB for primary action per module

---

## HOUR 2-3: Mobile-First Redesign

### 2.1 Navigation (30 min)
- Sticky bottom tab bar: Dashboard, Schedule, Jobs, Money, More
- "More" sheet for secondary modules
- Badge counts, active indicators

### 2.2 Dashboard (20 min)
- Stack stat cards vertically on mobile
- Collapsible onboarding checklist
- Quick actions: New Job, New Customer, New Quote
- Today's schedule preview

### 2.3 Jobs (25 min)
- Card list with status colors on mobile
- Large tap areas, no hover-dependent actions
- Sticky bottom action bar: Call, SMS, Complete, Invoice

### 2.4 Money (20 min)
- Quote/Invoice cards: amount, status, due date
- One-tap: Send, Mark Paid, Download PDF
- Numpad-friendly payment input

### 2.5 Customers & Schedule (25 min)
- Customer list: search prominent, tap-to-call
- Customer detail: action bar (Call, SMS, Email, New Job)
- Schedule: day view default on mobile

---

## HOUR 3-4: Full Testing

### 3.1 Automated (20 min)
- `npx tsc --noEmit` + `npm test` + production build
- Fix failures before proceeding

### 3.2 Module Tests (60 min)
Auth, Dashboard, Jobs, Customers, Quotes, Invoices, Schedule, Money, Tracking, Settings, Leads — full flows as non-technical user on mobile viewport.

### 3.3 Usability (20 min)
5 tasks unaided: Add customer+job, Send quote, Record payment, Find schedule, Share tracking link.

### 3.4 Regression (20 min)
- Desktop not broken, French renders, no console errors

---

## HOUR 4-5: Comms & Release

### 4.1 Email via Resend Free Tier (30 min)
- Resend: 3,000 emails/month free, no card
- Wire: quote sent, invoice sent, password reset
- Test with real emails to user's Gmail

### 4.2 SMS — $0 Approach (20 min)
- No free server-side SMS exists; use native `sms:` deep links
- Pre-filled templates per action
- Document Twilio upgrade path

### 4.3 Release Checklist (30 min)
Build green, tests pass, no console errors, mobile nav works, email verified, SMS verified, French check, Lighthouse > 80.

### 4.4 Deploy & Verify (40 min)
- Commit, push via stored token, Vercel deploys
- Live smoke test on production
- Clean up test data

---

## What You Can Test After

1. Mobile feel on iPhone: bottom tabs, big buttons, cards
2. Real emails: Send quote → check inbox
3. SMS: Job page → Text customer → Messages opens pre-filled
4. Onboarding: New account → real guided setup
5. Tracking: New design with instructions + live indicators

## Success Criteria
- Every module one-thumb usable on iPhone
- 5 core tasks completable unaided
- Real email received from production
- SMS link opens pre-filled
- Zero console errors, all tests green, production Ready
