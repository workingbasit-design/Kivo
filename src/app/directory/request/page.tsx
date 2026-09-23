import { Suspense } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import QuoteRequestForm from '@/components/QuoteRequestForm';

export const metadata = {
  title: 'Request free quotes | EveryJob Directory',
  description:
    'Tell us what you need and your city — up to 5 matching local pros get your request. Free, no commission.',
};

export default function QuoteRequestPage() {
  return (
    <div className="min-h-screen bg-paper font-sans">
      <header className="bg-ink text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/directory" className="text-xs text-white/60 hover:text-white">
            ← Back to directory
          </Link>
          <div className="flex items-center gap-3 mt-3">
            <Logo tone="onDark" size={30} />
              <span className="text-sm font-semibold text-white/60">Directory</span>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
          <QuoteRequestForm />
        </Suspense>
      </main>
    </div>
  );
}
