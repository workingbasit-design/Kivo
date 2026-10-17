# Kit conventions (Part 1, all-modules redesign)

Every component in `src/components/kit/` follows these rules. No exceptions.

## Tokens — the ONLY colours

Dual-valued utilities from the mockup (light on `:root`, dark under `.dark`).
They flip automatically; **never write `dark:` variants in kit components.**

| Purpose | Utility examples |
|---|---|
| Page bg | `bg-bg` |
| Card / surface | `bg-surface`, `bg-surface-2` |
| Borders | `border-line`, `border-line-strong` |
| Text | `text-ink`, `text-ink-2` (secondary) |
| Primary action (lime) | `bg-hivis text-hivis-ink`, soft `bg-hivis-soft` |
| Warning | `text-warn-text`, `bg-warn-bg`, `border-warn-line`, `text-warn` |
| Danger / late | `text-danger`, `bg-danger-bg` |
| Success / done | `text-ok`, `bg-ok-bg` |
| Info | `text-info`, `bg-info-bg` |
| Star ratings | `text-star` |
| Business brand | `bg-biz` (white text on it) |
| Collected hero panel | `bg-hero text-hero-ink`, `text-hero-ink-2`, `border-hero-line`, `bg-hero-2` |
| Tab bar | `bg-nav`, `text-nav-ink`, `text-nav-active` |
| Charts | `bg-chart-a`, `bg-chart-b` |
| Toast | `bg-toast-bg text-toast-ink` |
| Focus ring | `ring-focus` / `outline-focus` |
| Sticky top bar | `bg-topbar` |

**Absolutely forbidden in kit code:** hex (`#fff`, `[#D4F24C]`), `rgb()/rgba()/hsl()`,
Tailwind default palette classes (`bg-white`, `text-black`, `bg-red-500`,
`text-zinc-600`, `border-gray-200`, …), inline `style={{ color: … }}`.

## Type

- Interface text: default (Barlow via body). Numbers and money: wrap in
  `<span className="num">` (Barlow Condensed, tabular + lining figures).
- Headings: `font-bold tracking-tight` as in the mockup (h1 28px, h2 21px/18px).

## Rules

1. `'use client'` only when the component needs interactivity (state/handlers).
   Prefer server-renderable presentational components.
2. TypeScript strict. Export a `Props` interface per component.
3. **All copy is a prop.** No hard-coded English/French strings inside kit
   components (labels, placeholders, aria-labels). The showcase supplies copy.
4. Icons: `import { … } from '@/components/icons'` (Phosphor, single family).
   Icon-only buttons get an `aria-label` prop.
5. Layout helpers: `cn` from `@/lib/utils`.
6. Touch targets: interactive elements ≥ 44px (`min-h-[44px] min-w-[44px]`).
7. Focus: `:focus-visible` gets `outline-focus`/`ring-focus` treatment
   (e.g. `focus-visible:outline-2 focus-visible:outline-focus`).
8. Every kit component's OUTERMOST element carries `data-kit="<kebab-name>"`
   (e.g. `data-kit="card"`). The dark-mode CI test queries these.
9. Borders on cards/rows: `border border-line`; dividers inside lists:
   `divide-line` or `border-t border-line`.
10. Reduced motion: transitions use `motion-safe:` prefix where the mockup
    animates (toggles, sheets, toasts).
11. Radius: `rounded-[14px]`/`rounded-2xl` for cards, `rounded-full` for pills,
    matching the mockup. Elevation: `shadow-kit-card`, `shadow-kit-pop`,
    `shadow-kit-sheet`, `shadow-kit-toast`.
12. Never import from `@/components/design/*` (the old Part C library uses
    single-valued tokens). The kit is self-contained in `src/components/kit/`.

## File layout

One file per component: `src/components/kit/TopBar.tsx`, etc.
`src/components/kit/index.ts` re-exports everything.
Keep each file small and readable; mirror the mockup's structure and class
names where sensible, but write real components — never paste mockup HTML.
