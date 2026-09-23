import React from 'react';
import Link from 'next/link';
import EveryJobLogo from '@/components/EveryJobLogo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      <nav className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <EveryJobLogo size={32} />
          <span className="text-xl font-bold tracking-tight text-zinc-900">EveryJob</span>
        </Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <p className="text-center text-xs text-zinc-400 pb-6">
        Every job. One place.
      </p>
    </div>
  );
}
