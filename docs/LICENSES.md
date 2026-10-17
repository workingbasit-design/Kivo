# Third-party licences

This file records the licences of vendored third-party assets, as required by
the dashboard rebuild spec (Part B: "Confirm the licence").

## Barlow + Barlow Condensed (type)

- **Source:** Google Fonts (https://fonts.google.com/specimen/Barlow)
- **Licence:** SIL Open Font License 1.1 (OFL)
- **Files:** `public/fonts/barlow-{400,500,600,700}.woff2`,
  `public/fonts/barlowcondensed-{500,600,700}.woff2` (latin subsets only)
- **Use:** interface text (Barlow) and numbers / big figures (Barlow Condensed),
  self-hosted via `next/font/local` with `font-display: swap`. No runtime
  requests to Google Fonts.
- Added: Part B of the dashboard rebuild (2026-10-17).

## Phosphor Icons (icons)

- **Source:** https://phosphoricons.com (https://github.com/phosphor-icons/core,
  v2.1.1)
- **Licence:** ISC License (Copyright (c) 2020 Phosphor Icons)
- **Files:** generated `src/components/icons/phosphor.tsx` (only the icons the
  app uses, regular + duotone weights) via `scripts/gen-icons.mjs` from
  `scripts/icon-map.json`. No icon font, no new npm dependency.
- **Use:** the single icon family app-wide (Part B). Regular weight for
  inactive, duotone (outline + soft fill) for active/status.
- Added: Part B of the dashboard rebuild (2026-10-17).
