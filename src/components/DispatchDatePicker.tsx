'use client';

import { useRouter } from 'next/navigation';

export default function DispatchDatePicker({
  currentDate,
  label,
}: {
  currentDate: string;
  label: string;
}) {
  const router = useRouter();

  return (
    <input
      type="date"
      value={currentDate}
      onChange={(e) => {
        if (e.target.value) {
          router.push(`/dispatch?date=${e.target.value}`);
        }
      }}
      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm min-h-[44px]"
      aria-label={label}
    />
  );
}
