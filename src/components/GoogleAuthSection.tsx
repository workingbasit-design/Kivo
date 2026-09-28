'use client';

import { Suspense } from 'react';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import GoogleAuthError from '@/components/GoogleAuthError';
import { useT } from '@/components/LanguageToggle';

/**
 * Google sign-in block for the login / register pages: callback error
 * alert, the "Continue with Google" button, and an "or" divider above
 * the password form (which is untouched).
 *
 * `ageGate` is set on the register page only: the Google button stays
 * blocked until the age checkbox is ticked.
 */
function SectionInner({
  ageGate,
}: {
  ageGate?: { checked: boolean; onBlocked: () => void };
}) {
  const { t } = useT();
  return (
    <div>
      <GoogleAuthError />
      <GoogleSignInButton ageGate={ageGate} />
      <div className="flex items-center gap-3 my-5" aria-hidden="true">
        <div className="flex-1 h-px bg-zinc-200" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {t('googleAuth.orDivider')}
        </span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>
    </div>
  );
}

export default function GoogleAuthSection({
  ageGate,
}: {
  ageGate?: { checked: boolean; onBlocked: () => void };
}) {
  return (
    <Suspense fallback={null}>
      <SectionInner ageGate={ageGate} />
    </Suspense>
  );
}
