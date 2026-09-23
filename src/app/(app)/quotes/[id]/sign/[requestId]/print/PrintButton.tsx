'use client';

import { Printer } from 'lucide-react';
import { secondaryBtnClass } from '@/components/ui';

/** Print button for the signed-document view. Hidden in the printed output. */
export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={secondaryBtnClass + ' print:hidden'}
    >
      <Printer size={14} /> {label}
    </button>
  );
}
