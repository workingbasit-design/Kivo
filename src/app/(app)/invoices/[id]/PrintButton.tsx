'use client';

import { Printer } from '@/components/icons';

import { Button } from '@/components/kit';

export default function PrintButton() {
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      variant="secondary" className=" print:hidden"
    >
      <Printer size={14} /> Print
    </Button>
  );
}
