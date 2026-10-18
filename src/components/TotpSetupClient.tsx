'use client';

/**
 * B7.4 TOTP enrollment UI. Three states: disabled (start setup), pending
 * (enter a code to confirm), enabled (show backup-code reminder + disable).
 * No QR-code library (no new dependencies): the secret is shown for manual
 * entry into any authenticator app.
 */
import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Copy, Check } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { Button, Input } from '@/components/kit';
import { beginTotpSetup, confirmTotpSetup, disableTotp } from '@/app/actions/totp';

export default function TotpSetupClient({
  locale,
  initiallyEnabled,
  requiredNotice,
}: {
  locale: Locale;
  initiallyEnabled: boolean;
  requiredNotice: boolean;
}) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await beginTotpSetup();
    setBusy(false);
    if (r.error || !r.secret) {
      setError(r.error ?? 'Something went wrong.');
      return;
    }
    setSecret(r.secret);
    setOtpauthUrl(r.otpauthUrl ?? null);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const r = await confirmTotpSetup(code);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setBackupCodes(r.backupCodes ?? []);
    setEnabled(true);
    setSecret(null);
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    const r = await disableTotp(password);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setEnabled(false);
    setPassword('');
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable - the secret is visible to type manually */
    }
  };

  return (
    <div className="bg-surface border border-line shadow-kit-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        {enabled ? (
          <ShieldCheck size={22} className="text-ok" />
        ) : (
          <ShieldAlert size={22} className="text-warn-text" />
        )}
        <div>
          <h2 className="text-base font-bold text-ink">{t(locale, 'security.totpTitle')}</h2>
          <p className="text-sm text-ink-2">{t(locale, 'security.totpSubtitle')}</p>
        </div>
      </div>

      {requiredNotice && !enabled && (
        <div role="alert" className="rounded-xl bg-warn-bg border border-warn-line text-warn-text text-sm px-4 py-3">
          {t(locale, 'security.totpRequiredNotice')}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-danger-bg border border-line text-danger text-sm px-4 py-3">
          {error}
        </div>
      )}

      {!enabled && !secret && (
        <Button type="button" variant="primary" onClick={start} disabled={busy}>
          {busy ? t(locale, 'security.working') : t(locale, 'security.enableTotp')}
        </Button>
      )}

      {!enabled && secret && !backupCodes && (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">{t(locale, 'security.totpManualEntry')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm font-mono tracking-wider break-all">
              {secret}
            </code>
            <Button
              type="button"
              variant="ghost"
              sm
              onClick={copySecret}
              aria-label={t(locale, 'security.copySecret')}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
          {otpauthUrl && (
            <p className="text-xs text-ink-2 break-all">
              {t(locale, 'security.otpauthHint')}
              <span className="font-mono">{otpauthUrl}</span>
            </p>
          )}
          <Input
            label={t(locale, 'security.totpCodeLabel')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={9}
          />
          <Button type="button" variant="primary" onClick={confirm} disabled={busy || code.trim().length < 6}>
            {busy ? t(locale, 'security.working') : t(locale, 'security.confirmTotp')}
          </Button>
        </div>
      )}

      {backupCodes && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-ink">{t(locale, 'security.backupCodesTitle')}</p>
          <p className="text-sm text-ink-2">{t(locale, 'security.backupCodesHint')}</p>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((c) => (
              <code key={c} className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-mono text-center">
                {c}
              </code>
            ))}
          </div>
        </div>
      )}

      {enabled && !backupCodes && (
        <div className="space-y-4">
          <p className="text-sm text-ok font-medium">{t(locale, 'security.totpOn')}</p>
          <Input
            label={t(locale, 'security.confirmPasswordLabel')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button
            type="button"
            variant="danger"
            sm
            onClick={disable}
            disabled={busy || !password}
          >
            {busy ? t(locale, 'security.working') : t(locale, 'security.disableTotp')}
          </Button>
        </div>
      )}
    </div>
  );
}
