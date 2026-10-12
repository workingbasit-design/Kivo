'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import MorphChips from './MorphChips';

/** Rating filter with morphing chip transitions (client wrapper). */
export default function DirectoryRatingFilter({
  options,
  anyLabel,
  starsUp,
  minRatingLabel,
}: {
  options: readonly string[];
  anyLabel: string;
  starsUp: string;
  minRatingLabel: string;
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
      <span className="text-white/60 font-medium text-xs">{minRatingLabel}</span>
      <MorphChips
        options={options}
        value={current}
        onChange={onChange}
        groupId="directory-rating"
        tone="dark"
        format={(v) => (v === '' ? anyLabel : starsUp.replace('{v}', v))}
      />
    </div>
  );
}
