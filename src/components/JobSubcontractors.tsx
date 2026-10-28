'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, Input, Select } from '@/components/kit';
import { formatMoney } from '@/lib/money';
import {
  assignSubcontractor,
  removeSubcontractorFromJob,
  listJobSubcontractors,
  type JobSubRow,
} from '@/app/actions/subcontractors';

export interface JobSubPickerSub {
  id: string;
  name: string;
  defaultRateCents: number | null;
}

/**
 * Slice 7: subcontractors assigned to a job, with hours + payout.
 * Payouts are records only (no money movement) and feed the job
 * costing subcontractor bucket via the server-side summary.
 */
export default function JobSubcontractors({
  jobId,
  locale,
  currency,
  subs,
  initialJobSubs,
}: {
  jobId: string;
  locale: Locale;
  currency?: string;
  subs: JobSubPickerSub[];
  initialJobSubs: JobSubRow[];
}) {
  const L = (k: string) => t(locale, `subcontractors.${k}`);
  const [rows, setRows] = useState<JobSubRow[]>(initialJobSubs);
  const [assignSub, setAssignSub] = useState('');
  const [assignHours, setAssignHours] = useState('');
  const [assignAmount, setAssignAmount] = useState('');
  const [edits, setEdits] = useState<Record<string, { hours: string; amount: string; note: string }>>({});
  const [pending, startTransition] = useTransition();

  const assignedIds = new Set(rows.map((r) => r.subcontractorId));
  const available = subs.filter((s) => !assignedIds.has(s.id));
  const subtotal = rows.reduce((sum, r) => sum + (r.amountCents ?? 0), 0);

  const refresh = async () => {
    const r = await listJobSubcontractors(jobId);
    if (r.ok && r.jobSubs) setRows(r.jobSubs);
  };

  const editFor = (row: JobSubRow) =>
    edits[row.id] ?? {
      hours: row.hours != null ? String(row.hours) : '',
      amount: row.amountCents != null ? String(row.amountCents / 100) : '',
      note: row.note ?? '',
    };

  const saveRow = (row: JobSubRow) => {
    const e = editFor(row);
    startTransition(async () => {
      const r = await assignSubcontractor(jobId, row.subcontractorId, {
        hours: e.hours,
        amount: e.amount,
        note: e.note,
      });
      if (!r.ok) toast.error(L('saveError'));
      else {
        toast.success(L('saved'));
        await refresh();
      }
    });
  };

  const assign = () => {
    if (!assignSub) return;
    startTransition(async () => {
      const r = await assignSubcontractor(jobId, assignSub, {
        hours: assignHours,
        amount: assignAmount,
      });
      if (!r.ok) toast.error(L('saveError'));
      else {
        toast.success(L('assigned'));
        setAssignSub('');
        setAssignHours('');
        setAssignAmount('');
        await refresh();
      }
    });
  };

  const remove = (row: JobSubRow) => {
    startTransition(async () => {
      const r = await removeSubcontractorFromJob(jobId, row.subcontractorId);
      if (!r.ok) toast.error(L('saveError'));
      else {
        toast.success(L('removed'));
        await refresh();
      }
    });
  };

  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-sm font-bold text-ink mb-1">{L('jobSectionTitle')}</h2>
      <p className="text-[13px] text-ink-2 mb-4">{L('jobSectionHint')}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-2 py-2">{L('noAssigned')}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => {
            const e = editFor(row);
            return (
              <li key={row.id} className="border border-line rounded-2xl p-3.5 space-y-3">
                <p className="text-sm font-bold text-ink">{row.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={L('hours')}
                    value={e.hours}
                    onChange={(ev) => setEdits({ ...edits, [row.id]: { ...e, hours: ev.target.value } })}
                    inputMode="decimal"
                    placeholder="2.5"
                  />
                  <Input
                    label={L('amount')}
                    value={e.amount}
                    onChange={(ev) => setEdits({ ...edits, [row.id]: { ...e, amount: ev.target.value } })}
                    inputMode="decimal"
                    placeholder="150.00"
                  />
                </div>
                <Input
                  label={L('note')}
                  value={e.note}
                  onChange={(ev) => setEdits({ ...edits, [row.id]: { ...e, note: ev.target.value } })}
                  placeholder={L('notePlaceholder')}
                />
                <div className="flex gap-2">
                  <Button variant="primary" type="button" disabled={pending} onClick={() => saveRow(row)}>
                    {L('save')}
                  </Button>
                  <Button variant="secondary" type="button" disabled={pending} onClick={() => remove(row)}>
                    {L('remove')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {subtotal > 0 && (
        <p className="text-sm font-bold text-ink mt-4">
          {L('payoutSubtotal')}: {formatMoney(subtotal, currency)}
        </p>
      )}

      {available.length > 0 && (
        <div className="mt-5 pt-4 border-t border-line space-y-3">
          <Select
            label={L('assign')}
            name="assign-sub"
            value={assignSub}
            onChange={(e) => setAssignSub(e.target.value)}
            options={[{ value: '', label: L('assignPlaceholder') }, ...available.map((s) => ({ value: s.id, label: s.name }))]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label={L('hours')} value={assignHours} onChange={(e) => setAssignHours(e.target.value)} inputMode="decimal" placeholder="2.5" />
            <Input label={L('amount')} value={assignAmount} onChange={(e) => setAssignAmount(e.target.value)} inputMode="decimal" placeholder="150.00" />
          </div>
          <Button variant="primary" type="button" disabled={pending || !assignSub} onClick={assign}>
            {L('assignAction')}
          </Button>
        </div>
      )}
    </Card>
  );
}
