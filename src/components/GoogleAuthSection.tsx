'use client';

import { Suspense } from 'react';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import GoogleAuthError from '@/components/GoogleAuthError';
import { useT } from '@/components/LanguageToggle';

/**
 * Google sign-in block for the login / register pages: callback error
 * alert, the "Continue with Google" button, and an "or" divider above
 * the password form (which is untouched).
 */
function SectionInner() {
  const { t } = useT();
  return (
    <div>
      <GoogleAuthError />
      <GoogleSignInButton />
      <div className="flex items-center gap-3 my-5" aria-hidden="true">
        <div className="flex-1 h-px bg-line" />
        <span className="text-[11px] font-semibold text-ink-2">
          {t('googleAuth.orDivider')}
        </span>
        <div className="flex-1 h-px bg-line" />
      </div>
    </div>
  );
}

export default function GoogleAuthSection() {
  return (
    <Suspense fallback={null}>
      <SectionInner />
    </Suspense>
  );
}
