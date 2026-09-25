'use client';

/**
 * PWA install prompt banner.
 *
 * Listens for the browser's `beforeinstallprompt` event (Chrome/Edge/Android)
 * and shows a small banner offering one-tap install — no app store, no
 * download fees. Hidden when already installed, dismissed, or unsupported
 * (iOS Safari: no event; the banner simply never appears).
 *
 * Mount once near the top of the app shell:  <PwaInstallPrompt locale={locale} />
 */
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { primaryBtnClass } from '@/components/ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'everyjob-pwa-install-dismissed';

export default function PwaInstallPrompt({ locale = 'en' }: { locale?: Locale }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already running as an installed PWA — nothing to offer.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* private mode — just don't persist the dismissal */
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // hold the event so our banner drives it
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setDeferred(null);
      setVisible(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || !deferred) return null;
  const tr = (p: string) => t(locale, `pwa.install.${p}`);

  const install = async () => {
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
        setDeferred(null);
        return;
      }
    } catch {
      /* fall through to dismiss */
    }
    dismiss();
  };

  const dismiss = () => {
    setVisible(false);
    setDeferred(null);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-label={tr('title')}
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:max-w-sm z-50 rounded-2xl bg-zinc-900 text-white p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime text-ink">
          <Download size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm">{tr('title')}</p>
          <p className="mt-1 text-xs text-zinc-300 leading-relaxed">{tr('body')}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={install} className={primaryBtnClass}>
              {tr('installBtn')}
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label={tr('dismissBtn')}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-3 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
