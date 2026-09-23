'use client';

import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { useT } from '@/components/LanguageToggle';

/** Map ?google=<code> callback failures to a localized message. */
const CODE_TO_KEY: Record<string, string> = {
  'not-configured': 'googleAuth.notConfigured',
  denied: 'googleAuth.signInFailed',
  'rate-limited': 'googleAuth.signInFailed',
  'session-mismatch': 'googleAuth.sessionMismatch',
  'token-exchange': 'googleAuth.signInFailed',
  'verify-failed': 'googleAuth.signInFailed',
  'email-unverified': 'googleAuth.emailUnverified',
};

export default function GoogleAuthError() {
  const params = useSearchParams();
  const { t } = useT();
  const code = params.get('google');
  if (!code) return null;
  const key = CODE_TO_KEY[code] ?? 'googleAuth.signInFailed';
  return (
    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5 mb-4">
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <span>{t(key)}</span>
    </div>
  );
}
