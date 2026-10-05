/**
 * Generates all EveryJob brand icon assets from ONE layered SVG source of
 * truth — public/icons/icon-source.svg ("Icon Composer" style: layered
 * Liquid Glass artwork, not a flat static PNG).
 *
 * Run: node scripts/generate-icons.mjs
 *
 * Outputs:
 *   public/icons/icon-192.png         (PWA, layered tile w/ transparency)
 *   public/icons/icon-512.png         (PWA, layered tile w/ transparency)
 *   public/icons/maskable-512.png     (PWA maskable: full-bleed, safe zone)
 *   public/icons/apple-touch-icon.png (180x180, full-bleed, iOS masks it)
 *   public/favicon.ico                (16/32/48 PNG-compressed ICO)
 *   public/favicon.svg                (layered vector, rewritten)
 *
 * No new dependencies: sharp is already used by Next.js.
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const source = readFileSync(join(outDir, 'icon-source.svg'), 'utf8');
if (!source.includes('<g clip-path="url(#ej-clip)">')) {
  throw new Error('icon-source.svg: layered group <g clip-path="url(#ej-clip)"> not found');
}

/** Layered squircle tile on transparency (PWA "any" icons). */
function tileSvg() {
  return source;
}

/**
 * Full-bleed charcoal canvas with the layered mark scaled into the
 * maskable safe zone (markScale 0.8 => artwork inside the 80% circle).
 */
function fullBleedSvg(markScale) {
  const anchor = '<g clip-path="url(#ej-clip)">';
  const idx = source.indexOf(anchor);
  const before = source.slice(0, idx);
  const after = source.slice(idx);
  const closed = after.replace(/<\/g>\s*<\/svg>\s*$/, '</g></g></svg>');
  if (closed === after) throw new Error('icon-source.svg: unexpected closing tags');
  const pad = ((1 - markScale) / 2) * 1024;
  return (
    before +
    '<rect width="1024" height="1024" fill="#161616"/>' +
    `<g transform="translate(${pad} ${pad}) scale(${markScale})">` +
    closed
  );
}

/** Layered vector favicon (64 grid) — same layers as the 1024 source. */
function faviconSvg() {
  const eLines = [
    '<line x1="24" y1="18" x2="24" y2="46"/>',
    '<line x1="24" y1="18" x2="44" y2="18"/>',
    '<line x1="24" y1="32" x2="40" y2="32"/>',
    '<line x1="24" y1="46" x2="44" y2="46"/>',
  ].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<defs>` +
    `<linearGradient id="fj-base" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#252527"/><stop offset="1" stop-color="#121213"/></linearGradient>` +
    `<linearGradient id="fj-lime" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#d9fb6d"/><stop offset="1" stop-color="#b9e838"/></linearGradient>` +
    `<linearGradient id="fj-glass" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.32"/>` +
    `<stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="fj-clip"><rect x="2" y="2" width="60" height="60" rx="16"/></clipPath>` +
    `</defs>` +
    `<g clip-path="url(#fj-clip)">` +
    `<rect x="2" y="2" width="60" height="60" rx="16" fill="url(#fj-base)"/>` +
    `<rect x="2" y="2" width="60" height="60" fill="url(#fj-glass)"/>` +
    `<g stroke="#87ad2b" stroke-width="7" stroke-linecap="round" fill="none" transform="translate(0,1.4)">${eLines}</g>` +
    `<g stroke="url(#fj-lime)" stroke-width="7" stroke-linecap="round" fill="none">${eLines}</g>` +
    `<rect x="2" y="2" width="60" height="3" fill="#ffffff" opacity="0.18"/>` +
    `</g></svg>`;
}

/** Minimal ICO writer: PNG-compressed entries, 16/32/48px. */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const parts = [header];
  for (const { size, data } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size, 0);
    e.writeUInt8(size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    parts.push(e);
    offset += data.length;
  }
  for (const { data } of entries) parts.push(data);
  return Buffer.concat(parts);
}

async function render(svg, size, dest) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(dest);
  console.log('wrote', dest);
}

await render(tileSvg(), 192, join(outDir, 'icon-192.png'));
await render(tileSvg(), 512, join(outDir, 'icon-512.png'));
// Maskable: full-bleed with the mark inside the ~80% safe circle.
await render(fullBleedSvg(0.8), 512, join(outDir, 'maskable-512.png'));
// Apple touch icon: full-bleed (iOS applies its own rounded mask).
await render(fullBleedSvg(1), 180, join(outDir, 'apple-touch-icon.png'));

const favicon = faviconSvg();
writeFileSync(join(root, 'public', 'favicon.svg'), favicon);
console.log('wrote public/favicon.svg');

const icoEntries = [];
for (const size of [48, 32, 16]) {
  const data = await sharp(Buffer.from(tileSvg())).resize(size, size).png().toBuffer();
  icoEntries.push({ size, data });
}
writeFileSync(join(root, 'public', 'favicon.ico'), buildIco(icoEntries));
console.log('wrote public/favicon.ico');
console.log('done');
