'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import MorphChips from './MorphChips';

/** Rating filter with morphing chip transitions (client wrapper). */
export default function DirectoryRatingFilter({
  options,
  anyLabel,
  starsUp,
  minRatingLabel,
  tone = 'light',
}: {
  options: readonly string[];
  anyLabel: string;
  starsUp: string;
  minRatingLabel: string;
  /** 'light' for light backgrounds, 'dark' for dark backgrounds */
  tone?: 'light' | 'dark';
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get('minRating') ?? '';

  const onChange = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set('minRating', v);
    else next.delete('minRating');
    router.push(`/directory?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`font-medium text-xs ${tone === 'dark' ? 'text-hero-ink-2' : 'text-ink-2'}`}>{minRatingLabel}</span>
      <MorphChips
        options={options}
        value={current}
        onChange={onChange}
        groupId="directory-rating"
        tone={tone}
        format={(v) => (v === '' ? anyLabel : starsUp.replace('{v}', v))}
      />
    </div>
  );
}
