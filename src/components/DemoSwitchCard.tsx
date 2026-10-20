'use client';

import { useActionState } from 'react';
import { openDemoBusiness, leaveDemoBusiness, type DemoResult } from '@/app/actions/demo';
import { Card, Button } from '@/components/kit';

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
      <h2 className="text-sm font-bold text-ink mb-1">{title}</h2>
      <p className="text-xs text-ink-2 mb-4">{description}</p>
      {isDemo ? (
        <>
          <p className="text-xs font-semibold text-warn-text mb-3">{viewingLabel}</p>
          <form action={leaveAction}>
            <Button variant="secondary" type="submit">
              {backLabel}
            </Button>
          </form>
        </>
      ) : (
        <form action={openAction}>
          <Button variant="secondary" type="submit">
            {openLabel}
          </Button>
          {openState?.error && (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              {openState.error}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
