# EveryJob Design System — Liquid Glass (2026)

One page: the material, the icon, the motion, the rules. Inspired by Apple's
2026 design playbook (Liquid Glass / Icon Composer / SF Symbols / Design
Awards inclusivity), expressed in EveryJob's own charcoal + lime identity.
All treatments are original — no Apple assets.

## 1. The material: Liquid Glass

One material, adapts to the context. Three recipes in `src/app/globals.css`:

| Class | Context | Recipe |
|---|---|---|
| `.ej-glass-card` | Light surfaces: stat cards, panels | Translucent white gradient, `blur(24px) saturate(170%)`, specular `::before` sheen, hairline edge |
| `.ej-glass-dark` | Dark floating surfaces: mobile tab bar pill, mobile top bar | Translucent ink gradient, `blur(28px) saturate(160%)`, specular sheen, deep shadow. Sets `position: relative` — do not combine with `sticky`/`fixed` on the same node; wrap instead |
| `.ej-glass-dark-solid` | In-flow charcoal (desktop sidebar) | Opaque gradient + specular edge only — nothing scrolls behind, so no translucency. Sets no position; safe on sticky nodes |

Rules:

- Glass must always have something to refract. Never put `.ej-glass-dark`
  on a surface with a flat opaque background behind it — use `-solid`.
- Text on glass keeps contrast: inactive tab labels are `text-white/70`
  minimum on dark glass; body text on light glass stays zinc-900.
- Icon chips: `GlassIcon` / `glassClass(tone)` in `src/components/ui.tsx`
  (tones: zinc, emerald, amber, blue, indigo; sizes sm/md/lg). The chip
  itself is `ej-liquid` — frosted tile + specular top light + hover sheen.
- Interactive press: `ej-spring` (scale 0.86 + brightness lift, iOS-style
  overshoot easing). Entrances: `ej-rise` with `--ej-d` stagger.
- `prefers-reduced-motion`: all of the above go still. No exceptions.

## 2. The icon: layered, one design

`public/icons/icon-source.svg` is the single source of truth — four layers,
back to front:

1. Charcoal squircle base (vertical depth gradient `#252527 → #121213`)
2. Glass cover sheet (translucent white, top-lit)
3. Lime E: darker offset depth layer (`#87ad2b`, +22 units) + bright gradient face (`#d9fb6d → #b9e838`)
4. Specular streak (skewed white band) + top edge light

Regenerate everything with `node scripts/generate-icons.mjs` (sharp is
already a dependency — no new packages):

- `icon-192.png`, `icon-512.png` — PWA "any" (tile on transparency)
- `maskable-512.png` — full-bleed, mark in the 80% safe circle
- `apple-touch-icon.png` — 180px full-bleed (iOS masks it)
- `favicon.svg` — layered vector, rewritten by the script
- `favicon.ico` — 16/32/48 PNG-compressed ICO, written in pure node

In-app, `src/components/EveryJobLogo.tsx` renders the same four layers —
one design on every surface. Guarded by
`src/lib/__tests__/pwa-icons.test.mts` (manifest sizes vs. real PNGs,
ICO validity, layer presence).

## 3. Icons in product UI (SF Symbols spirit)

Lucide is the icon family — no new dependencies. Conventions:

- **One family.** Never mix another icon set; draw new glyphs from lucide.
- **Scale:** 12–14 inline micro, 16–18 nav/buttons, 20–24 feature/empty-state.
  (Audited 2026-10-05: ~600 usages already cluster on this scale; no outliers.)
- **Align with text:** icons sit in flex rows or chips — never bare inline
  without vertical alignment. The old `-mt-0.5` nudges are grandfathered;
  prefer flex alignment for new code.
- **Match the style:** 2px stroke default; inherit `currentColor`; decorative
  icons are `aria-hidden` (lucide default); meaningful ones get labels.

## 4. Inclusivity (Design Awards lens)

- Touch targets ≥ 44px on every nav control (tabs are 60px).
- Visible focus rings on all glass surfaces (`outline-lime` on dark glass).
- Contrast verified on glass: white/70+ on dark glass, zinc-900 on light.
- Color is never the only signal (active tab has label + indicator bar).
- French (fr-CA) ships with every string — glass has no language.

## 5. What not to do

- No new icon/image dependencies without asking (project rule).
- No flat "static PNG" one-offs: all raster icons come from the SVG source.
- No glass on low-contrast text, no glass without refraction, no motion
  without a reduced-motion path.
