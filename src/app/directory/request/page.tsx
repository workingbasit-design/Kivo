import { Suspense } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import QuoteRequestForm from '@/components/QuoteRequestForm';

export const metadata = {
  title: 'Request free quotes | Kivo Directory',
  description:
    'Tell us what you need and your city — up to 5 matching local pros get your request. Free, no commission.',
};

export default function QuoteRequestPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] font-sans">
      <header className="bg-[#17122b] text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/directory" className="text-xs text-[#b8b0c9] hover:text-white">
            ← Back to directory
          </Link>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-9 h-9 rounded-xl bg-[#6329d4] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-bold tracking-tight">Kivo Directory</p>
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
