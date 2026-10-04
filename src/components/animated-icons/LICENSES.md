# Animated icon assets — license record

Collected 2026-10-04. All files are Lottie JSON, downloaded at $0 with no
account, no login, no trial, no payment.

## MIT-licensed icons (commercial use allowed, no visible attribution required)

MIT requires the copyright/license notice to travel with the files. Keep this
folder (or a copy of the notices) in the repo. No in-app credit or footer link
is required.

### useAnimations — calendar.json, bell.json, success.json, customers.json, settings.json
- Source: `react-useanimations` npm package v2.10.0 (raw JSON files shipped in
  the package under `lib/<name>/<name>.json`)
- Project: https://github.com/useAnimations/react-useanimations — "a collection
  of free animated open source icons" · https://useanimations.com
- License: MIT — declared in the package's package.json (`"license": "MIT"`).
  Note: the GitHub repo has no machine-readable LICENSE file (GitHub reports
  the repo license as "Other"/NOASSERTION); the MIT declaration comes from the
  published npm package metadata.
- Commercial use: yes, unrestricted. Attribution: not required beyond keeping
  this notice with the files.
- Style: minimal line icons, 32x32 canvas, single black stroke. bell.json also
  has one white detail stroke (black main + white detail).
- Icon mapping: calendar.json = calendar · bell.json = notification ·
  success.json = checkmark · customers.json = userPlus (person with plus) ·
  settings.json = settings.

### lottie-icons — location.json
- Source: `lottie-icons` npm package v1.1.3 (animation data extracted from the
  published `dist/lottie-icons.es.js` bundle and re-serialized as JSON;
  byte-equivalent to the package's `locationAnimation` export)
- Project: https://www.npmjs.com/package/lottie-icons ("Beautiful animated
  React icons powered by Lottie - Lucide-style API")
- License: MIT — full license text preserved in LICENSE-lottie-icons-MIT.txt
  ("Copyright (c) 2025 Lottie Icons").
- Commercial use: yes, unrestricted. Attribution: not required beyond keeping
  the notice with the files.
- Style: Lucide-style line icon, 128x128 canvas (scales cleanly; larger canvas
  than the useAnimations set), single black stroke.

## Recoloring notes
All icons use black strokes (`[0,0,0,1]`), so they are trivially recolorable by
replacing that color array (e.g. with the EveryJob lime or a light tone for the
dark theme). bell.json additionally uses one white stroke (`[1,1,1,1]`) for a
detail — recolor the black and leave/adjust the white as needed.

## Gaps — no verified $0 commercial Lottie JSON found
- invoice.json (invoices/money) and tools.json (tools/wrench): no source found
  that is simultaneously (a) verifiably licensed for commercial use at $0,
  (b) downloadable without an account, and (c) actually a Lottie JSON file.
- Investigated and excluded:
  - Lordicon free icons — license conflict: lordicon.com/docs/license/attribution
    says free icons may be used in "personal or commercial projects" with
    attribution, but their WordPress.org plugin listing says free icons are
    "personal, non-commercial use" and commercial rights require PRO. Unresolved.
  - LottieFiles free animations — Lottie Simple License does allow commercial
    use with no required attribution, but downloads require a free account
    (login), and the license has a share-alike clause on the Files themselves.
  - IconScout free animations — downloads require an account (login).
  - Unicorn Icons — export requires a free account; pages simultaneously claim
    "No attribution required" and that Pro "removes attribution" (contradictory).
  - Lottieflow (Finsweet) — requires a free account to download.
  - Icons8 animated icons — free tier requires visible attribution and downloads
    appear to require an account; no login-free JSON path verified.
- Nearby MIT options for the parent to consider: the `lottie-icons` package also
  ships MIT `customer`, `user`, and `coupon` animations (coupon is semantically
  weak for invoices). `lucide-animated` on npm is MIT and covers wrench/map-pin/
  wallet in consistent Lucide style, but animates via Framer Motion, not Lottie.
