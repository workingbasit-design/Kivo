/**
 * Unit tests for universal attachments (Track 6A): pure helpers in
 * src/lib/attachments.ts plus en/fr parity of the attachments i18n
 * fragment. No HTTP, no DB — pure logic only.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/attachments.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAttachmentEntityType,
  validateAttachmentFile,
  sanitizeFileName,
  buildBlobPathname,
  formatFileSize,
  isImageMime,
  MAX_ATTACHMENT_BYTES,
  ATTACHMENT_MIME_TYPES,
} from '@/lib/attachments.ts';
import fragment from '../i18n/fragments/attachments.ts';

test('entity type allowlist accepts the six entities, rejects everything else', () => {
  for (const ok of ['job', 'customer', 'quote', 'invoice', 'review', 'lead']) {
    assert.equal(isAttachmentEntityType(ok), true, ok);
  }
  for (const bad of ['', 'business', 'user', 'JOB', 'job ', 'session', '../../../etc']) {
    assert.equal(isAttachmentEntityType(bad), false, bad);
  }
});

test('file validation accepts good files at the boundary', () => {
  assert.equal(validateAttachmentFile({ size: 1, type: 'image/jpeg' }), null);
  assert.equal(validateAttachmentFile({ size: MAX_ATTACHMENT_BYTES, type: 'application/pdf' }), null);
  assert.equal(validateAttachmentFile({ size: 500, type: 'text/csv' }), null);
});

test('file validation rejects oversize files', () => {
  assert.equal(
    validateAttachmentFile({ size: MAX_ATTACHMENT_BYTES + 1, type: 'image/png' }),
    'tooLarge'
  );
});

test('file validation rejects disallowed mime types', () => {
  assert.equal(validateAttachmentFile({ size: 100, type: 'application/octet-stream' }), 'badType');
  assert.equal(validateAttachmentFile({ size: 100, type: 'image/svg+xml' }), 'badType');
  assert.equal(validateAttachmentFile({ size: 100, type: 'text/html' }), 'badType');
  assert.equal(validateAttachmentFile({ size: 100, type: '' }), 'badType');
});

test('file validation rejects empty files', () => {
  assert.equal(validateAttachmentFile({ size: 0, type: 'image/jpeg' }), 'empty');
  assert.equal(validateAttachmentFile({ size: -5, type: 'image/jpeg' }), 'empty');
});

test('mime allowlist is exactly the six supported types', () => {
  assert.deepEqual([...ATTACHMENT_MIME_TYPES].sort(), [
    'application/pdf',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
  ]);
});

test('sanitizeFileName strips path traversal', () => {
  assert.equal(sanitizeFileName('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFileName('..\\..\\windows\\x.png'), 'x.png');
  assert.equal(sanitizeFileName('/abs/path/photo.jpg'), 'photo.jpg');
});

test('sanitizeFileName replaces hostile characters and drops leading dots', () => {
  assert.equal(sanitizeFileName('my photo (1).png'), 'my_photo__1_.png');
  assert.equal(sanitizeFileName('.hidden.jpg'), 'hidden.jpg');
  assert.equal(sanitizeFileName('café ☕.pdf'), 'caf___.pdf');
  assert.equal(sanitizeFileName('a'.repeat(200) + '.png'), 'a'.repeat(100));
});

test('sanitizeFileName falls back to "file" for empty/hostile names', () => {
  assert.equal(sanitizeFileName(''), 'file');
  assert.equal(sanitizeFileName('...'), 'file');
  assert.equal(sanitizeFileName('///'), 'file');
});

test('buildBlobPathname scopes by business/entity and is traversal-free', () => {
  const p = buildBlobPathname({
    businessId: 'biz123',
    entityType: 'job',
    entityId: 'job456',
    uid: 'abc123xyz',
    fileName: '../../evil.png',
  });
  assert.equal(p, 'attachments/biz123/job/job456/abc123xyz-evil.png');
  assert.ok(!p.includes('..'));
});

test('buildBlobPathname sanitizes hostile uid and filename', () => {
  const p = buildBlobPathname({
    businessId: 'b',
    entityType: 'quote',
    entityId: 'q',
    uid: '../../x/../',
    fileName: 'ok name.pdf',
  });
  assert.ok(!p.includes('..'));
  assert.ok(p.startsWith('attachments/b/quote/q/'));
  assert.ok(p.endsWith('-ok_name.pdf'));
});

test('isImageMime matches image/* only', () => {
  assert.equal(isImageMime('image/jpeg'), true);
  assert.equal(isImageMime('image/webp'), true);
  assert.equal(isImageMime('application/pdf'), false);
  assert.equal(isImageMime('text/csv'), false);
});

test('formatFileSize formats bytes, KB and MB', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(2048), '2.0 KB');
  assert.equal(formatFileSize(10 * 1024 * 1024), '10.0 MB');
});

function keysOf(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...keysOf(v as Record<string, unknown>, path));
    else out.push(path);
  }
  return out;
}

test('attachments fragment: fr has every en key and no orphans', () => {
  const en = fragment.en.attachments as unknown as Record<string, unknown>;
  const fr = fragment.fr.attachments as unknown as Record<string, unknown>;
  const enKeys = keysOf(en).sort();
  const frKeys = keysOf(fr).sort();
  assert.deepEqual(frKeys, enKeys, 'en/fr key mismatch in attachments fragment');
});
