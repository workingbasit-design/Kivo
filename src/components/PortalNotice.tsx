import { FileWarning, Link2Off, Timer } from 'lucide-react';
import { Card } from '@/components/ui';

/**
 * Friendly, data-free notice for the public quote/invoice portals.
 * Never reveals whether a document exists — invalid, expired and revoked
 * tokens all get the same safe message.
 */
export default function PortalNotice({
  variant,
}: {
  variant: 'expired' | 'legacy' | 'rate-limited';
}) {
  const copy = {
    expired: {
      icon: <Link2Off size={36} className="mx-auto text-zinc-300 mb-3" />,
      title: 'This link is expired or invalid',
      body: 'The link may have been revoked, expired, or typed incorrectly. Please ask the business to send you a fresh link.',
    },
    legacy: {
      icon: <FileWarning size={36} className="mx-auto text-amber-400 mb-3" />,
      title: 'This link format is no longer used',
      body: 'Share links have been upgraded for better security. Please ask the business to send you a new link — the document itself is unchanged.',
    },
    'rate-limited': {
      icon: <Timer size={36} className="mx-auto text-zinc-300 mb-3" />,
      title: 'Too many requests',
      body: 'Please wait a minute and try again.',
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
