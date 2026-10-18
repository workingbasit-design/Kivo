'use client';

import { Printer } from '@/components/icons';

import { Button } from '@/components/kit';

/** Print button for the signed-document view. Hidden in the printed output. */
export default function PrintButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      variant="secondary" className=" print:hidden"
    >
      <Printer size={14} /> {label}
    </Button>
  );
}
