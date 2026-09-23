import { FileWarning, Link2Off, Timer } from 'lucide-react';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { Card } from '@/components/ui';

/**
 * Friendly, data-free notice for the public quote/invoice portals.
 * Never reveals whether a document exists — invalid, expired and revoked
 * tokens all get the same safe message.
 */
export default async function PortalNotice({
  variant,
}: {
  variant: 'expired' | 'legacy' | 'rate-limited';
}) {
  const locale = await getLocale();
  const copy = {
    expired: {
      icon: <Link2Off size={36} className="mx-auto text-zinc-300 mb-3" />,
      title: t(locale, 't10money.noticeExpiredTitle'),
      body: t(locale, 't10money.noticeExpiredBody'),
    },
    legacy: {
      icon: <FileWarning size={36} className="mx-auto text-amber-400 mb-3" />,
      title: t(locale, 't10money.noticeLegacyTitle'),
      body: t(locale, 't10money.noticeLegacyBody'),
    },
    'rate-limited': {
      icon: <Timer size={36} className="mx-auto text-zinc-300 mb-3" />,
      title: t(locale, 't10money.noticeRateTitle'),
      body: t(locale, 't10money.noticeRateBody'),
    },
  }[variant];

  return (
    <div className="min-h-screen bg-paper font-sans">
      <main className="max-w-lg mx-auto px-4 py-16">
        <Card className="p-8 text-center">
          {copy.icon}
          <h1 className="text-lg font-bold text-zinc-900">{copy.title}</h1>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{copy.body}</p>
        </Card>
      </main>
    </div>
  );
}
