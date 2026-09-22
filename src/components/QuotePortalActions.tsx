'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { portalQuoteDecisionByToken } from '@/app/actions/quotes';
import { primaryBtnClass, secondaryBtnClass } from '@/components/ui';

export default function QuotePortalActions({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function decide(decision: 'APPROVED' | 'DECLINED') {
    setMessage(null);
    startTransition(async () => {
      const res = await portalQuoteDecisionByToken(token, decision);
      if (res.ok) {
        router.refresh();
      } else {
        setMessage(res.error ?? 'Something went wrong. Please try again.');
        if (res.status) router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {message && (
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
          {message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('APPROVED')}
          className={`${primaryBtnClass} justify-center !py-3 !text-sm !bg-emerald-600 hover:!bg-emerald-700`}
        >
          <Check size={16} /> {pending ? 'Please wait…' : 'Approve quote'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('DECLINED')}
          className={`${secondaryBtnClass} justify-center !py-3 !text-sm`}
        >
          <X size={16} /> Decline
        </button>
      </div>
      <p className="text-[11px] text-zinc-400 text-center">
        Your response is sent to the business immediately.
      </p>
    </div>
  );
}
