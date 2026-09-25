'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { secondaryBtnClass } from '@/components/ui';

const NEXT: Record<string, { status: string; key: string }[]> = {
  open: [
    { status: 'answered', key: 'inboxMarkAnswered' },
    { status: 'closed', key: 'inboxMarkClosed' },
  ],
  answered: [
    { status: 'closed', key: 'inboxMarkClosed' },
    { status: 'open', key: 'inboxReopen' },
  ],
  closed: [{ status: 'open', key: 'inboxReopen' }],
};

export default function TicketStatusButtons({
  id,
  status,
  locale = 'en',
}: {
  id: string;
  status: string;
  locale?: Locale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const setStatus = async (next: string) => {
    setBusy(true);
    try {
      await fetch('/api/support/ticket', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, status: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {(NEXT[status] ?? []).map((a) => (
        <button
          key={a.status}
          type="button"
          disabled={busy}
          onClick={() => setStatus(a.status)}
          className={secondaryBtnClass}
        >
          {t(locale, `support.${a.key}`)}
        </button>
      ))}
    </div>
  );
}
