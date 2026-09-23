'use client';

import { useT } from '@/components/LanguageToggle';

/** Google "G" mark (multi-colour), drawn inline — no external assets. */
export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.1.1c2.1-2 3.4-4.9 3.4-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5l-.1.1-3.7 2.9v.1C3.5 21.4 7.5 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.7-2.9-.1.1C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.6 1.3 6.6l3.9 3c1-2.9 3.7-4.9 6.8-4.9z"
      />
    </svg>
  );
}

/**
 * "Continue with Google" button. Starts the OIDC flow at
 * /api/auth/google (password login below it is untouched).
 */
export default function GoogleSignInButton({ returnTo }: { returnTo?: string }) {
  const { t } = useT();
  const href = returnTo ? `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}` : '/api/auth/google';
  return (
    <a
      href={href}
      className="w-full bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2.5"
    >
      <GoogleG />
      {t('googleAuth.continueWithGoogle')}
    </a>
  );
}
