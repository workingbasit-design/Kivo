/**
 * Universal attachments (Track 6A): pure helpers for validating uploaded
 * files and building safe Vercel Blob pathnames.
 *
 * No I/O here — the server actions in src/app/actions/attachments.ts and the
 * API route import these. Unit-tested without HTTP or DB.
 */

/** Entity types that may carry attachments (matches Attachment.entityType). */
export const ATTACHMENT_ENTITY_TYPES = [
  'job',
  'customer',
  'quote',
  'invoice',
  'review',
  'lead',
] as const;

export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

/** Hard cap per file: 10 MB. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Mime allowlist: common images + PDF + CSV only. */
export const ATTACHMENT_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/csv',
] as const;

/** Error codes returned by file validation (mapped to i18n in the client). */
export type AttachmentFileError = 'empty' | 'tooLarge' | 'badType';

export function isAttachmentEntityType(value: string): value is AttachmentEntityType {
  return (ATTACHMENT_ENTITY_TYPES as readonly string[]).includes(value);
}

/**
 * Validate an uploaded file's size and mime type.
 * Returns null when the file is acceptable, otherwise an error code.
 */
export function validateAttachmentFile(file: {
  size: number;
  type: string;
}): AttachmentFileError | null {
  if (!Number.isFinite(file.size) || file.size <= 0) return 'empty';
  if (file.size > MAX_ATTACHMENT_BYTES) return 'tooLarge';
  if (!ATTACHMENT_MIME_TYPES.includes(file.type)) return 'badType';
  return null;
}

/**
 * Make a user-supplied filename safe for a Blob pathname:
 * strip directories (path traversal), replace hostile characters,
 * drop leading dots (hidden files), cap length.
 */
export function sanitizeFileName(name: string): string {
  const noDirs = String(name).split('/').pop()?.split('\\').pop() ?? '';
  const cleaned = noDirs.replace(/[^a-zA-Z0-9._-]/g, '_');
  const unhidden = cleaned.replace(/^\.+/, '');
  const trimmed = unhidden.slice(0, 100);
  return trimmed || 'file';
}

export function buildBlobPathname(args: {
  businessId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  uid: string;
  fileName: string;
}): string {
  const { businessId, entityType, entityId, uid, fileName } = args;
  const safeUid = String(uid).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32) || 'x';
  return `attachments/${businessId}/${entityType}/${entityId}/${safeUid}-${sanitizeFileName(fileName)}`;
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** Human-friendly byte count, e.g. "2.4 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
