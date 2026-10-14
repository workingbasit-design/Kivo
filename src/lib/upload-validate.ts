/**
 * Server-side upload validation (Prompt 3, B12).
 *
 * Never trusts the client-supplied MIME type or extension: the declared type
 * must match the file's magic bytes. SVG is rejected outright (scriptable
 * XML). JPEGs are scanned for GPS EXIF tags; GPS-tagged photos are rejected
 * until the user approves `sharp`-based re-encoding (decision pending - the
 * rejection path is implemented here, re-encoding is the Open item).
 *
 * Pure functions - unit-tested under plain node:test.
 */

/** MIME types we accept, keyed by their magic-byte signature. */
export type DetectedMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'application/pdf'
  | null; // unknown / not a supported binary type

export function detectMimeFromBytes(bytes: Uint8Array): DetectedMime {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  // GIF: GIF87a / GIF89a
  if (
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  // PDF: %PDF-
  if (
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
    bytes[3] === 0x46 && bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }
  return null;
}

/** True when the bytes look like SVG/XML text (rejected: scriptable). */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder().decode(bytes.slice(0, 512)).trimStart().toLowerCase();
  return head.startsWith('<svg') || head.startsWith('<?xml');
}

/** True when the bytes look like an executable/script (MZ, ELF, shebang). */
export function looksLikeExecutable(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  // MZ (Windows), ELF (\x7fELF)
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return true;
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return true;
  // shebang
  if (bytes[0] === 0x23 && bytes[1] === 0x21) return true;
  return false;
}

export type UploadVerdict =
  | { ok: true; detectedMime: DetectedMime | 'text/csv' }
  | { ok: false; reason: 'badMagic' | 'svg' | 'executable' | 'gps' | 'binaryCsv' };

/**
 * Validate uploaded bytes against the declared MIME type.
 * - declaredType: the client-supplied MIME (untrusted - used only to decide
 *   which check applies, never trusted on its own).
 */
export function validateUploadBytes(
  bytes: Uint8Array,
  declaredType: string
): UploadVerdict {
  if (looksLikeExecutable(bytes)) return { ok: false, reason: 'executable' };
  if (looksLikeSvg(bytes)) return { ok: false, reason: 'svg' };

  if (declaredType === 'text/csv') {
    // CSV must be plausible text: no NUL bytes, decodable as UTF-8.
    if (bytes.includes(0)) return { ok: false, reason: 'binaryCsv' };
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, 4096));
    } catch {
      return { ok: false, reason: 'binaryCsv' };
    }
    return { ok: true, detectedMime: 'text/csv' };
  }

  const detected = detectMimeFromBytes(bytes);
  if (!detected || detected !== declaredType) return { ok: false, reason: 'badMagic' };

  // B12.4: GPS-tagged photos are rejected (sharp re-encoding is the pending
  // user decision; until then the safe path is rejection).
  if (detected === 'image/jpeg' && hasGpsExif(bytes)) {
    return { ok: false, reason: 'gps' };
  }
  return { ok: true, detectedMime: detected };
}

/**
 * Best-effort GPS EXIF detection in a JPEG: walks the APP1/Exif segment for
 * IFD0 tag 0x8825 (GPS IFD pointer). Returns false when the EXIF structure
 * is absent or unparseable (fail-open on GPS only - the file itself was
 * already magic-byte validated; the sharp re-encoding decision will make
 * this fail-closed by stripping EXIF instead of rejecting).
 */
export function hasGpsExif(bytes: Uint8Array): boolean {
  try {
    // Walk JPEG markers to find APP1 (0xFFE1).
    let i = 2; // skip SOI (FFD8)
    while (i + 4 < bytes.length) {
      if (bytes[i] !== 0xff) return false;
      const marker = bytes[i + 1];
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker === 0xe1 && len > 14) {
        const seg = bytes.slice(i + 4, i + 2 + len);
        if (hasGpsInExifSegment(seg)) return true;
      }
      if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
      i += 2 + len;
    }
  } catch {
    // Unparseable - fail open on GPS (documented above).
  }
  return false;
}

function hasGpsInExifSegment(seg: Uint8Array): boolean {
  // "Exif\0\0" header, then a TIFF header.
  if (seg.length < 14) return false;
  const head = new TextDecoder().decode(seg.slice(0, 6));
  if (head !== 'Exif\0\0') return false;
  const tiff = seg.slice(6);
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return false;
  const u16 = (o: number) =>
    little ? tiff[o] | (tiff[o + 1] << 8) : (tiff[o] << 8) | tiff[o + 1];
  const u32 = (o: number) =>
    little
      ? tiff[o] | (tiff[o + 1] << 8) | (tiff[o + 2] << 16) | (tiff[o + 3] << 24)
      : (tiff[o] << 24) | (tiff[o + 1] << 16) | (tiff[o + 2] << 8) | tiff[o + 3];
  if (u16(2) !== 42) return false; // TIFF magic
  const ifd0 = u32(4);
  if (ifd0 + 2 > tiff.length) return false;
  const entries = u16(ifd0);
  for (let e = 0; e < entries; e++) {
    const off = ifd0 + 2 + e * 12;
    if (off + 12 > tiff.length) break;
    if (u16(off) === 0x8825) return true; // GPS IFD pointer
  }
  return false;
}
