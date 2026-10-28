'use client';

import { useState } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { Card } from '@/components/kit';
import { formatMoney } from '@/lib/money';
import SubcontractorForm from './SubcontractorForm';
import { listSubcontractors, type SubcontractorRow } from '@/app/actions/subcontractors';

/** Slice 7: directory list with inline create + per-row edit. */
export default function SubcontractorDirectory({
  locale,
  currency,
  initial,
}: {
  locale: Locale;
  currency?: string;
  initial: SubcontractorRow[];
}) {
  const L = (k: string) => t(locale, `subcontractors.${k}`);
  const [rows, setRows] = useState<SubcontractorRow[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = async () => {
    const r = await listSubcontractors();
    if (r.ok && r.subcontractors) setRows(r.subcontractors);
  };

  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm font-bold text-ink">{L('noSubs')}</p>
          <p className="text-sm text-ink-2 mt-1">{L('noSubsDesc')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold text-ink truncate">{s.name}</p>
                  <p className="text-xs text-ink-2 mt-0.5">
                    {s.defaultRateCents != null ? `${formatMoney(s.defaultRateCents, currency)}/${L('perHour')}` : L('noRate')}
                    {' · '}
                    {L('jobs').replace('{count}', String(s.jobCount))}
                  </p>
                  {s.phone && <p className="text-xs text-ink-2 mt-0.5">{s.phone}</p>}
                  {s.email && <p className="text-xs text-ink-2 mt-0.5">{s.email}</p>}
                </div>
                <button
                  type="button"
                  className="text-sm font-bold text-ink underline shrink-0"
                  aria-label={`Edit ${s.name}`}
                  onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                >
                  {L('edit')}
                </button>
              </div>
              {editingId === s.id && (
                <div className="mt-4 pt-4 border-t border-line">
                  <SubcontractorForm locale={locale} initial={s} onDone={refresh} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <section>
        <button
          type="button"
          className="text-sm font-bold text-ink underline"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? L('hideCreate') : L('newSub')}
        </button>
        {showCreate && (
          <Card className="p-5 mt-3">
            <SubcontractorForm
              locale={locale}
              initial={null}
              onDone={() => {
                setShowCreate(false);
                refresh();
              }}
            />
          </Card>
        )}
      </section>
    </div>
  );
}
