# Part D: Navigation and structure

**Status:** Built 2026-10-17. Approval gate waived by user; decisions documented here for morning review.

## Decision 1: Dashboard → Today

**Decision:** Rename "Dashboard" to "Today" (EN) / "Aujourd'hui" (FR).

**Rationale:** The screen is led by what needs attention (attention engine, today's agenda), not by a museum of metrics. "Today" says what it is. The principle "What's next before what's there" (DESIGN.md §2) supports this.

**Note:** `docs/UAT_TRIAGE.md` referenced in the prompt does not exist in the repo. Decision made on design principles, not UAT evidence.

**Implementation:** i18n labels changed (`nav.dashboard`, `dashboard.title`). URL stays `/dashboard` to avoid breaking bookmarks, redirects, and the 6 files referencing it.

## Decision 2: More menu order

**Decision:** Keep the current section order (Work, Money, Customers, Grow, Manage).

**Rationale:** No UAT usage data exists (`docs/UAT_TRIAGE.md` missing). The current order follows the user's workflow: do the work, get paid, manage customers, grow, administer. Will reorder when UAT evidence exists.

## App structure (text tree)

```
/ (marketing site, logged out)
├── /login, /signup
├── /book/[slug] (public booking)
├── /portal/* (customer portal, no login)
└── /(app) (logged in)
    ├── /dashboard ("Today")
    ├── /attention
    ├── /schedule
    ├── /jobs, /jobs/[id], /jobs/new
    ├── /projects, /projects/[id], /projects/new
    ├── /quotes, /quotes/[id], /quotes/new
    ├── /invoices, /invoices/[id], /invoices/new
    ├── /money
    ├── /customers, /customers/[id], /customers/new
    ├── /leads
    ├── /notifications, /notifications/[id]
    ├── /settings/*
    └── /more/* (via More sheet)
```

## Bottom tab bar (mobile)

**Five destinations:** Today, Schedule, Jobs, Money, More.

**Design (changed in Part D):**
- Solid `bg-ej-ink` surface. No glass, blur, or bubbles.
- Active tab: filled icon (Lucide `fill="currentColor"`), lime text, semibold/bold label, lime indicator bar.
- Inactive tabs: white/70 text, outline icon.
- All five items (including More) share identical styling. More is not styled differently.
- Safe area: `pb-[calc(0.375rem+env(safe-area-inset-bottom))]` on the bar; main content has `pb-[calc(12rem+env(safe-area-inset-bottom))]` to clear it (WCAG 2.4.11).

**Files:** `src/components/BottomNav.tsx`, `src/components/animated-icons/nav-icon.tsx` (added `filled` prop).

## Top bar

**Mobile:** `MobileNav` — brand + Copilot + search (⌘K palette) + notification bell. Sticky, respects safe area.

**Desktop:** `AppSidebar` — full navigation with search trigger and stats.

**Note:** The prompt asks for "the same layout on every screen: title, back (with previous screen's name), search, notifications, Copilot." The current architecture uses a persistent shell (sidebar/mobile nav) rather than per-screen top bars. Per-screen `PageHeader` components provide the title + actions. Unifying to a single top-bar pattern is deferred to Part E (screen-by-screen).

## One primary action per screen

**Fixed:** Dashboard had two "New job" buttons (PageHeader + empty state). Removed the empty-state duplicate. The PageHeader "New job" is the single primary action.

**Rule going forward:** List screens get "New" in the top bar (PageHeader actions). Forms get a sticky Save bar. Empty states describe and point to the top-bar action; they do not duplicate it.

**File:** `src/app/(app)/dashboard/page.tsx`.

## Record URLs

Every record has its own URL: `/jobs/[id]`, `/customers/[id]`, `/quotes/[id]`, `/invoices/[id]`, `/projects/[id]`, `/notifications/[id]`. Back-button scroll restoration relies on browser default; explicit scroll-position restoration is deferred to Part E.

## Wide screens (1024px+)

`AppSidebar` provides the desktop sidebar. Main content max-width 7xl. Two-pane list+detail layouts are per-screen work, deferred to Part E.

## Global search

Implemented as the command palette (⌘K / Ctrl+K), triggered by `PaletteTrigger` (sidebar + mobile top bar). Searches across customers, jobs, quotes, invoices. Grouped results and recent searches are palette features; verifying their completeness is Part E work.

## Notification centre

Exists at `/notifications`. Read/unread states (unread: bold + lime dot). Each notification links to its record via `/notifications/[id]/open` (marks read on open). Bell shows unread count (`getUnreadCount`). The count reflects actionable notifications generated from real records by `syncNotifications`.

## Wireframes (390px)

Text descriptions; visual wireframes are Part E deliverables.

**Bottom tab bar:**
```
┌─────────────────────────────────────┐
│ [Today] [Schedule] [Jobs] [Money] [More] │
│  lime    dim      dim     dim    dim  │
│  ● filled icon + bold label (active)  │
└─────────────────────────────────────┘
```

**Today screen order:**
1. Attention items (what needs you, one-tap actions)
2. Today's agenda
3. Money summary (compact, only metrics with data)
4. Setup checklist (until done)

## Built vs deferred

**Built:**
- BottomNav redesign (no glass/bubbles, filled active icon, identical More styling)
- NavIconView `filled` prop
- Dashboard → Today rename (labels only)
- Duplicate "New job" CTA removed

**Deferred to Part E:**
- Per-screen top-bar unification (title/back/search/notifications/Copilot)
- Two-pane layouts on desktop
- Scroll-position restoration on back
- Verifying global search result grouping
