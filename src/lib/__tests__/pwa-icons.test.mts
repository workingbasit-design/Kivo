/**
 * PWA icon integrity — every icon the manifest advertises must exist on disk
 * with exactly the advertised pixel size, and the layered SVG source of
 * truth (public/icons/icon-source.svg) must be present and well-formed.
 * This is the "one design, every platform" regression guard for the
 * Icon Composer-style icon pipeline (node scripts/generate-icons.mjs).
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/pwa-icons.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Read PNG width/height from the IHDR chunk (pure node, no deps). */
function pngSize(buf: Buffer): { width: number; height: number } {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buf.subarray(0, 8).equals(PNG_SIG), 'file has a PNG signature');
  // IHDR: length(4) + 'IHDR'(4) + width(4 BE) + height(4 BE) at offset 16.
  assert.equal(buf.toString('ascii', 12, 16), 'IHDR', 'first chunk is IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('manifest icon entries resolve to real PNGs at the advertised sizes', () => {
  const manifest = JSON.parse(
    readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8')
  );
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest lists icons');
  for (const icon of manifest.icons) {
    const m = /^(\d+)x(\d+)$/.exec(icon.sizes);
    assert.ok(m, `icon ${icon.src} has a parseable size`);
    const file = join(root, 'public', icon.src.replace(/^\//, ''));
    assert.ok(existsSync(file), `icon file exists: ${icon.src}`);
    const { width, height } = pngSize(readFileSync(file));
    assert.equal(width, Number(m[1]), `${icon.src} width matches manifest`);
    assert.equal(height, Number(m[2]), `${icon.src} height matches manifest`);
  }
});

test('apple-touch-icon exists at 180x180', () => {
  const file = join(root, 'public', 'icons', 'apple-touch-icon.png');
  assert.ok(existsSync(file), 'apple-touch-icon.png exists');
  const { width, height } = pngSize(readFileSync(file));
  assert.equal(width, 180, 'apple-touch-icon width is 180');
  assert.equal(height, 180, 'apple-touch-icon height is 180');
});

test('favicon.ico is a valid multi-size ICO', () => {
  const file = join(root, 'public', 'favicon.ico');
  assert.ok(existsSync(file), 'favicon.ico exists');
  const buf = readFileSync(file);
  assert.equal(buf.readUInt16LE(0), 0, 'ICO reserved field is 0');
  assert.equal(buf.readUInt16LE(2), 1, 'ICO type is 1 (icon)');
  const count = buf.readUInt16LE(4);
  assert.ok(count >= 2, `ICO carries multiple sizes (found ${count})`);
});

test('layered icon source of truth is present and well-formed', () => {
  const file = join(root, 'public', 'icons', 'icon-source.svg');
  assert.ok(existsSync(file), 'icon-source.svg exists');
  const svg = readFileSync(file, 'utf8');
  assert.ok(svg.includes('<svg'), 'is SVG');
  assert.ok(svg.includes('clip-path="url(#ej-clip)"'), 'has the layered clip group');
  // The four Icon Composer-style layers, back to front.
  assert.ok(svg.includes('id="ej-base"'), 'layer 1: charcoal base gradient');
  assert.ok(svg.includes('id="ej-glass"'), 'layer 2: glass cover sheet');
  assert.ok(svg.includes('id="ej-lime"'), 'layer 3: lime E face');
  assert.ok(svg.includes('id="ej-spec"'), 'layer 4: specular streak');
});
