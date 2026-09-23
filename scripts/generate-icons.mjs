/**
 * Generates all Kivo brand icon assets from a single SVG source of truth.
 * Run: node scripts/generate-icons.mjs && python3 scripts/ico.py
 *
 * Outputs:
 *   public/icons/icon-192.png        (PWA, rounded tile w/ transparency)
 *   public/icons/icon-512.png        (PWA, rounded tile w/ transparency)
 *   public/icons/maskable-512.png    (PWA maskable, full-bleed)
 *   public/icons/apple-touch-icon.png (180x180, full-bleed, no transparency)
 *   /tmp/kivo-icon-64.png            (staging for favicon.ico via PIL)
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const MAIN =
  'M256 108 C270 208 304 242 404 256 C304 270 270 304 256 404 C242 304 208 270 108 256 C208 242 242 208 256 108 Z';
const SMALL =
  'M368 128 C372 152 380 160 404 164 C380 168 372 176 368 200 C364 176 356 168 332 164 C356 160 364 152 368 128 Z';

const DEFS = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8B5CF6"/>
      <stop offset="0.55" stop-color="#6D28D9"/>
      <stop offset="1" stop-color="#4C1D95"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.32"/>
      <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>`;

const SPARKLES = `
  <path d="${MAIN}" fill="#FFFFFF"/>
  <path d="${SMALL}" fill="#FFFFFF" opacity="0.92"/>`;

function tileSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${DEFS}
  <rect x="8" y="8" width="496" height="496" rx="112" fill="url(#bg)"/>
  <rect x="8" y="8" width="496" height="496" rx="112" fill="url(#gloss)"/>${SPARKLES}
</svg>`;
}

function fullBleedSvg(markScale = 1) {
  const inner =
    markScale === 1
      ? SPARKLES
      : `<g transform="translate(256 256) scale(${markScale}) translate(-256 -256)">${SPARKLES}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${DEFS}
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#gloss)"/>${inner}
</svg>`;
}

async function render(svg, size, dest) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(dest);
  console.log('wrote', dest);
}

await render(tileSvg(), 512, join(outDir, 'icon-512.png'));
await render(tileSvg(), 192, join(outDir, 'icon-192.png'));
// Apple touch icon: full-bleed (iOS applies its own mask; transparency shows black).
await render(fullBleedSvg(0.78), 180, join(outDir, 'apple-touch-icon.png'));
// Maskable: full-bleed with the mark inside the ~72% safe zone.
await render(fullBleedSvg(0.62), 512, join(outDir, 'maskable-512.png'));
// Staging PNG for favicon.ico (multi-size ICO built with PIL in scripts/make-favicon.py).
await render(tileSvg(), 64, '/tmp/kivo-icon-64.png');
console.log('done');
