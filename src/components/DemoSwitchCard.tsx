'use client';

import { useActionState } from 'react';
import { openDemoBusiness, leaveDemoBusiness, type DemoResult } from '@/app/actions/demo';
import { Card, secondaryBtnClass } from '@/components/ui';

const initialState: DemoResult = {};

/**
 * Part 0 (dashboard rebuild): owner-only Settings card that opens the demo
 * business for UAT demos and design reviews, or returns to the caller's own
 * business when already viewing the demo.
 */
export default function DemoSwitchCard({
  isDemo,
  title,
  description,
  viewingLabel,
  openLabel,
  backLabel,
}: {
  isDemo: boolean;
  title: string;
  description: string;
  viewingLabel: string;
  openLabel: string;
  backLabel: string;
}) {
  const [openState, openAction] = useActionState(openDemoBusiness, initialState);
  const [, leaveAction] = useActionState(leaveDemoBusiness, undefined);

  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-sm font-bold text-zinc-900 mb-1">{title}</h2>
      <p className="text-xs text-zinc-500 mb-4">{description}</p>
      {isDemo ? (
        <>
          <p className="text-xs font-semibold text-amber-700 mb-3">{viewingLabel}</p>
          <form action={leaveAction}>
            <button type="submit" className={secondaryBtnClass}>
              {backLabel}
            </button>
          </form>
        </>
      ) : (
        <form action={openAction}>
          <button type="submit" className={secondaryBtnClass}>
            {openLabel}
          </button>
          {openState?.error && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-700">
              {openState.error}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
