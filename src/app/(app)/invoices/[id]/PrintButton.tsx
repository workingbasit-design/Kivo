'use client';

import { Printer } from 'lucide-react';
import { secondaryBtnClass } from '@/components/ui';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={secondaryBtnClass + ' print:hidden'}
    >
      <Printer size={14} /> Print
    </button>
  );
}
