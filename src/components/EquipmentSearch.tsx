'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';

export default function EquipmentSearch({
  initialQuery,
  locale,
}: {
  initialQuery: string;
  locale: Locale;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const T = (k: string) => t(locale, `equipment.${k}`);

  const submit = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v.trim()) params.set('q', v.trim());
    else params.delete('q');
    startTransition(() => router.replace(`/equipment?${params.toString()}`));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className="relative"
    >
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          submit(e.target.value);
        }}
        placeholder={T('searchPlaceholder')}
        aria-label={T('searchPlaceholder')}
        className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-lime-500/40 focus:border-lime-500"
      />
    </form>
  );
}
