'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Button, Input, Textarea } from '@/components/kit';
import {
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
  type SubcontractorRow,
} from '@/app/actions/subcontractors';

/**
 * Slice 7: subcontractor directory create/edit form. All fields
 * controlled (form-reset lesson). Delete is blocked server-side while
 * any job assignment exists; the error surfaces inline.
 */
export default function SubcontractorForm({
  locale,
  initial,
  onDone,
}: {
  locale: Locale;
  initial: SubcontractorRow | null;
  onDone?: () => void;
}) {
  const L = (k: string) => t(locale, `subcontractors.${k}`);
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [rate, setRate] = useState(initial?.defaultRateCents != null ? String(initial.defaultRateCents / 100) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const r = initial
        ? await updateSubcontractor(initial.id, { name, phone, email, defaultRate: rate, note })
        : await createSubcontractor({ name, phone, email, defaultRate: rate, note });
      if (!r.ok) {
        setMsg(r.error === 'hasPayouts' ? L('deleteBlocked') : L('saveError'));
        return;
      }
      toast.success(L('saved'));
      if (!initial) {
        setName('');
        setPhone('');
        setEmail('');
        setRate('');
        setNote('');
      }
      onDone?.();
    });
  };

  const remove = () => {
    if (!initial) return;
    startTransition(async () => {
      const r = await deleteSubcontractor(initial.id);
      if (!r.ok) {
        setMsg(r.error === 'hasPayouts' ? L('deleteBlocked') : L('saveError'));
        return;
      }
      toast.success(L('deleted'));
      onDone?.();
    });
  };

  return (
    <div className="space-y-4">
      <Input label={L('name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={L('namePlaceholder')} maxLength={100} />
      <div className="grid grid-cols-2 gap-3">
        <Input label={L('phone')} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={40} />
        <Input label={L('email')} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" maxLength={200} />
      </div>
      <Input
        label={L('defaultRate')}
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        inputMode="decimal"
        placeholder="75.00"
        hint={L('defaultRateHint')}
      />
      <Textarea label={L('note')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('notePlaceholder')} maxLength={2000} />
      {msg && (
        <p className="text-sm text-danger" role="alert">
          {msg}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="primary" type="button" disabled={pending || !name.trim()} onClick={save}>
          {initial ? L('save') : L('create')}
        </Button>
        {initial &&
          (confirmingDelete ? (
            <>
              <Button variant="secondary" type="button" disabled={pending} onClick={remove}>
                {L('confirmDelete')}
              </Button>
              <Button variant="secondary" type="button" disabled={pending} onClick={() => setConfirmingDelete(false)}>
                {L('cancel')}
              </Button>
            </>
          ) : (
            <Button variant="secondary" type="button" disabled={pending} onClick={() => setConfirmingDelete(true)}>
              {L('delete')}
            </Button>
          ))}
      </div>
    </div>
  );
}
