/**
 * Backwards-compatible re-export of the generalized encryption module
 * (`src/lib/crypto.ts`). The key source is now `ENCRYPTION_KEY` with a
 * fallback to the legacy `MESSAGING_ENC_KEY`.
 */
export { encryptSecret, decryptSecret, isEncrypted, ENC_PREFIX } from '../crypto.ts';
