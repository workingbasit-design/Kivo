/** B7.4 TOTP tests, incl. RFC 6238 SHA-1 test vectors. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTotpSecret,
  base32Encode,
  base32Decode,
  totpCode,
  verifyTotp,
  totpOtpAuthUrl,
  generateBackupCodes,
  consumeBackupCode,
  hashBackupCode,
} from '../totp.ts';

// RFC 6238 Appendix B, SHA-1 vectors. Secret bytes are ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

describe('totp (RFC 6238 vectors)', () => {
  it('matches the RFC 6238 SHA-1 test vectors', () => {
    assert.equal(totpCode(RFC_SECRET, 59_000), '287082');
    assert.equal(totpCode(RFC_SECRET, 1_111_111_109_000), '081804');
    assert.equal(totpCode(RFC_SECRET, 1_234_567_890_000), '005924');
    assert.equal(totpCode(RFC_SECRET, 2_000_000_000_000), '279037');
  });
  it('verifies a current code and rejects wrong/expired codes', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    assert.equal(verifyTotp(secret, totpCode(secret, now), now), true);
    assert.equal(verifyTotp(secret, '000000', now), false);
    // 3 steps away is outside the ±1 window.
    assert.equal(verifyTotp(secret, totpCode(secret, now - 3 * 30_000), now), false);
    // Adjacent step is accepted (clock skew).
    assert.equal(verifyTotp(secret, totpCode(secret, now - 30_000), now), true);
  });
  it('rejects malformed codes', () => {
    const secret = generateTotpSecret();
    assert.equal(verifyTotp(secret, 'abc123', Date.now()), false);
    assert.equal(verifyTotp(secret, '12345', Date.now()), false);
    assert.equal(verifyTotp(secret, '', Date.now()), false);
  });
  it('base32 round-trips', () => {
    const secret = generateTotpSecret();
    assert.ok(/^[A-Z2-7]+$/.test(secret));
    assert.ok(base32Decode(secret).length >= 20);
  });
  it('otpauth URL is well-formed', () => {
    const url = totpOtpAuthUrl('JBSWY3DPEHPK3PXP', 'owner@example.ca');
    assert.ok(url.startsWith('otpauth://totp/EveryJob:owner%40example.ca?'));
    assert.ok(url.includes('secret=JBSWY3DPEHPK3PXP'));
  });
});

describe('backup codes', () => {
  it('generates 10 codes, each usable exactly once', () => {
    const { codes, hashes } = generateBackupCodes();
    assert.equal(codes.length, 10);
    assert.equal(hashes.length, 10);
    // Hashes never contain the code itself.
    for (const c of codes) assert.ok(!hashes.some((h) => h.includes(c.replace('-', ''))));
    const remaining = consumeBackupCode(hashes, codes[0]);
    assert.ok(remaining && remaining.length === 9);
    // Reuse fails.
    assert.equal(consumeBackupCode(remaining!, codes[0]), null);
    // Wrong code fails.
    assert.equal(consumeBackupCode(remaining!, '0000-0000'), null);
  });
  it('hashing is deterministic and normalized', () => {
    assert.equal(hashBackupCode('1234-5678'), hashBackupCode('12345678'));
  });
});
