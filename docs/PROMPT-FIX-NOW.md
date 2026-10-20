# EveryJob: make the design actually change

## Read this part yourself (not for Muse)

### Why it still looks the same

- **The shared design kit never went in.** [Likely] The proof is on your New invoice screen: "Cancel" and "Add item" are white buttons with almost-white text. That can't happen when every button takes its colours from one shared set. [Certain they're unreadable]
- **Old parts are still everywhere.** Muse has been changing what screens show (your dashboard now has "Where your money is"), but the old buttons, fields and cards stayed on every page. [Certain from your screenshots]
- **Prompts stacked up.** Each big prompt started before the last one was finished and proven. My prompts were too big for that loop, which made it easy for Muse to do half of each. [Likely]
- **The live site shows unfinished work.** You've been checking on kivo-nine-silk.vercel.app, which shows whatever was deployed, finished or not. [Likely]

### Do this, in order

Don't send Muse anything else until step 3 is done.

1. **Session 1: status report.** You find out what's really done.
2. **Session 2: install the kit, and only the kit.** It's finished only when the checks pass.
3. **Session 3: lock it in,** so unreadable or off-style screens can't go live again.

### How you check without taking anyone's word

- The hard-coded colour count reaches 0.
- The readability test passes in light and dark mode.
- You look at the preview link and the screenshots before anything goes live, not at kivo-nine-silk.vercel.app.

### File to add

Save everyjob-kit.css in your repo as `docs/design/everyjob-kit.css`, next to `docs/design/app-mockup.html`.

---

## Session 1: Status report (no code changes)

**Start Muse with:** `Read docs/PROMPT-FIX-NOW.md and do Session 1 only. Stop where it says to stop.`

Read AGENTS.md and follow it. Do not change any code in this session.

Report each item with proof: a commit, file path, or command output.

1. **Prompt progress.** For every part of `docs/PROMPT-ALL-MODULES.md` and `docs/PROMPT-DASHBOARD.md`, say whether it's done, partly done, or not started.
2. **Hard-coded colours.** Count them outside the kit and tokens files with:
   ```bash
   grep -rEn --include=*.ts --include=*.tsx --include=*.css \
     "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b" \
     src app components 2>/dev/null | grep -v "everyjob-kit.css" | grep -v "tokens" | wc -l
   ```
   List the 10 files with the most matches. If a match isn't a colour (an invoice number, for example), list it in `docs/design/colour-exceptions.txt`.
3. **Duplicate components.** List the button, input, select, card, chip and badge components, and say how many different versions of each exist (for example, how many button styles).
4. **Design files.** Say whether `docs/design/app-mockup.html` and `docs/design/everyjob-kit.css` are in the repo, and whether a `/design` page exists.
5. **Deploys.** Say which branch deploys to kivo-nine-silk.vercel.app, and whether other branches get preview links.
6. **Checks.** Say which automated tests or CI checks run before a deploy, if any.

Stop.

---

## Session 2: Install the kit (only this)

**Start Muse with:** `Read docs/PROMPT-FIX-NOW.md and do Session 2 only. Stop where it says to stop.`

Work on a new branch. Don't change features, data or wording except where this session says so.

1. **One source of style.**
   - `docs/design/everyjob-kit.css` is the single source of colours, type, spacing and component styles.
   - Either import it globally and use its classes, or, if the app uses Tailwind, map the theme colours to the same CSS variables (for example `surface: 'var(--surface)'`) and stop using Tailwind's default palette.
   - Either way, the pages must look like `docs/design/app-mockup.html`.
   - Self-host Barlow and Barlow Condensed.
2. **One component each.**
   - Button (primary, secondary, ghost, danger, small), Input, Select, Textarea, Date field, Card, List row, Chip, Badge, Banner, Sheet, Tab bar, Top bar.
   - Replace every old version on every page, then delete the old ones.
3. **Hard-coded colours: 0** outside the kit and tokens files, using the command from Session 1. Show the output.
4. **Fix these:**
   - "Cancel" on New invoice and "+ Add item" are white with near-white text. Make them secondary or ghost buttons.
   - "Create invoice" is dark grey on a dark page. It's the main action, so use the hi-vis primary style.
   - The invoice date field (and the project end date) spills past the card on iPhone. Use the kit's date field rules and check at 390 px in iPhone Safari or WebKit.
   - Remove "Tax is computed on the server. What you see is what gets billed." from the screen. That's a rule for the code, not text for users.
   - Tax on invoices and quotes gets one control instead of three (a dropdown, a % field, and 0% and 13% chips).
     - Default to the rate for the service address's province.
     - The owner can pick from a list of real rates, including "No tax (not registered for GST/HST)".
     - No free-typed percentages.
   - Line item placeholder: "For example, furnace tune-up" instead of "Item 1. E.g. Fan installation".
   - The Today tab uses the outlined duotone sun, not the filled one that looks like a settings gear. The Copilot button uses the sparkle icon, as in the mockup.
   - Where your money is:
     - Hide stages that are zero, and name them in one muted line, for example: "Nothing in leads, quotes, approvals or unpaid invoices."
     - Show whole dollars on the dashboard ($5,300, not $5,300.00).
5. **Done only when all of these are true, with proof:**
   - the colour count is 0
   - the readability test below passes on every page in light and dark mode
   - there are screenshots of every page at 390 px, light and dark, side by side with the mockup
   - it's on a preview link, not production

   Send me the preview link. Then stop.

### Readability test

Adjust the routes and the signed-in session to match the app.

```ts
// tests/kit/readability.spec.ts
// Fails when text is hard to read, or when a big light block appears in dark mode.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  '/', '/jobs', '/schedule', '/money', '/invoices/new', '/quotes/new',
  '/customers', '/leads', '/expenses', '/projects', '/equipment', '/settings',
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`readability, ${scheme}`, () => {
    test.use({
      colorScheme: scheme,
      viewport: { width: 390, height: 844 },
      storageState: 'tests/.auth/owner.json', // signed-in owner from the existing setup
    });

    for (const route of routes) {
      test(route, async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const contrast = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        expect(contrast.violations.flatMap(v => v.nodes.map(n => n.target.join(' ')))).toEqual([]);

        if (scheme === 'dark') {
          const lightBlocks = await page.evaluate(() => {
            const luminance = (c: string) => {
              const m = c.match(/rgba?\(([^)]+)\)/);
              if (!m) return 0;
              const [r, g, b, a = '1'] = m[1].split(',').map(s => s.trim());
              if (parseFloat(a) < 0.5) return 0;
              const lin = (v: string) => {
                const x = parseFloat(v) / 255;
                return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
              };
              return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
            };
            return Array.from(document.querySelectorAll<HTMLElement>('body *'))
              .filter(el => !['IMG', 'VIDEO', 'CANVAS'].includes(el.tagName))
              .filter(el => { const r = el.getBoundingClientRect(); return r.width * r.height >= 1600; })
              .filter(el => luminance(getComputedStyle(el).backgroundColor) > 0.9)
              .map(el => (el.tagName + ' ' + String(el.className)).slice(0, 120));
          });
          expect(lightBlocks).toEqual([]);
        }

        const name = route === '/' ? 'home' : route.slice(1).replace(/\//g, '-');
        await page.screenshot({ path: `test-results/kit/${scheme}-${name}.png`, fullPage: true });
      });
    }
  });
}
```

---

## Session 3: Lock it in

**Start Muse with:** `Read docs/PROMPT-FIX-NOW.md and do Session 3 only. Stop where it says to stop.`

1. **Checks on every push.** Set up GitHub Actions to run on every push. It fails if any of these fail:
   - the colour count (anything above 0)
   - the readability test
   - lint
   - typecheck
2. **Protect production.** kivo-nine-silk.vercel.app deploys only from main, and merging to main requires all of those checks to pass.
3. **Preview first.** Every future change goes to a preview link with light and dark screenshots before it's merged.
4. **Report** with the CI run link and a screenshot of the branch protection settings. Then stop.

---

## For every prompt after this

Add this sentence to the end of your start line: `Show me the preview link and light and dark screenshots before you call it done.`

---

## everyjob-kit.css

The full kit CSS pasted with this prompt is saved separately as `docs/design/everyjob-kit.css` (554 lines, exact copy).
