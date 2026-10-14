/** B12 upload validation tests: magic bytes, executables, SVG, GPS EXIF. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMimeFromBytes,
  looksLikeSvg,
  looksLikeExecutable,
  validateUploadBytes,
  hasGpsExif,
} from '../upload-validate.ts';

function bytes(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}
const text = (s: string) => new TextEncoder().encode(s);

describe('detectMimeFromBytes', () => {
  it('detects JPEG/PNG/WebP/GIF/PDF by magic bytes', () => {
    assert.equal(detectMimeFromBytes(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0)), 'image/jpeg');
    assert.equal(
      detectMimeFromBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0)),
      'image/png'
    );
    assert.equal(
      detectMimeFromBytes(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)),
      'image/webp'
    );
    assert.equal(
      detectMimeFromBytes(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0)),
      'image/gif'
    );
    assert.equal(
      detectMimeFromBytes(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0)),
      'application/pdf'
    );
  });
  it('returns null for unknown bytes', () => {
    assert.equal(detectMimeFromBytes(text('hello world, this is text')), null);
  });
});

describe('validateUploadBytes', () => {
  const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  it('accepts matching magic bytes', () => {
    const r = validateUploadBytes(jpeg, 'image/jpeg');
    assert.equal(r.ok, true);
  });
  it('rejects a renamed executable (MZ header claiming to be PNG)', () => {
    const exe = bytes(0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const r = validateUploadBytes(exe, 'image/png');
    assert.equal(r.ok, false);
    assert.equal((r as { reason: string }).reason, 'executable');
  });
  it('rejects an ELF binary claiming to be a PDF', () => {
    const elf = bytes(0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const r = validateUploadBytes(elf, 'application/pdf');
    assert.equal(r.ok, false);
    assert.equal((r as { reason: string }).reason, 'executable');
  });
  it('rejects an SVG with script even when declared as an image', () => {
    const svg = text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.equal(looksLikeSvg(svg), true);
    const r = validateUploadBytes(svg, 'image/svg+xml');
    assert.equal(r.ok, false);
    assert.equal((r as { reason: string }).reason, 'svg');
  });
  it('rejects a PNG whose bytes are actually JPEG (mismatch)', () => {
    const r = validateUploadBytes(jpeg, 'image/png');
    assert.equal(r.ok, false);
    assert.equal((r as { reason: string }).reason, 'badMagic');
  });
  it('accepts a plain-text CSV', () => {
    const csv = text('name,email\nAlice,alice@example.ca\n');
    const r = validateUploadBytes(csv, 'text/csv');
    assert.equal(r.ok, true);
  });
  it('rejects a binary file claiming to be CSV', () => {
    const bin = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const r = validateUploadBytes(bin, 'text/csv');
    assert.equal(r.ok, false);
  });
});

describe('hasGpsExif', () => {
  /** Minimal JPEG with an APP1/Exif segment whose IFD0 holds tag 0x8825. */
  function jpegWithGps(): Uint8Array {
    const exif = [
      ...text('Exif\0\0'),
      0x49, 0x49, // little-endian
      0x2a, 0x00, // TIFF magic 42
      0x08, 0x00, 0x00, 0x00, // IFD0 offset = 8
      0x01, 0x00, // 1 entry
      0x25, 0x88, // tag 0x8825 (GPS IFD)
      0x04, 0x00, // type LONG
      0x01, 0x00, 0x00, 0x00, // count 1
      0x1a, 0x00, 0x00, 0x00, // value offset
      0x00, 0x00, 0x00, 0x00, // next IFD
    ];
    const segLen = exif.length + 2;
    return new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xe1, // APP1
      (segLen >> 8) & 0xff, segLen & 0xff,
      ...exif,
      0xff, 0xd9, // EOI
    ]);
  }
  function jpegNoExif(): Uint8Array {
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xd9]);
  }
  it('detects the GPS IFD tag', () => {
    assert.equal(hasGpsExif(jpegWithGps()), true);
  });
  it('returns false for a JPEG without EXIF', () => {
    assert.equal(hasGpsExif(jpegNoExif()), false);
  });
  it('validateUploadBytes rejects GPS-tagged JPEGs', () => {
    const r = validateUploadBytes(jpegWithGps(), 'image/jpeg');
    assert.equal(r.ok, false);
    assert.equal((r as { reason: string }).reason, 'gps');
  });
});

describe('looksLikeExecutable', () => {
  it('flags MZ, ELF, and shebang', () => {
    assert.equal(looksLikeExecutable(bytes(0x4d, 0x5a, 0, 0)), true);
    assert.equal(looksLikeExecutable(bytes(0x7f, 0x45, 0x4c, 0x46)), true);
    assert.equal(looksLikeExecutable(text('#!/bin/bash\nevil')), true);
  });
  it('does not flag normal images', () => {
    assert.equal(looksLikeExecutable(bytes(0xff, 0xd8, 0xff, 0xe0)), false);
  });
});
