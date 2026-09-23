'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, UserPlus } from 'lucide-react';
import { createCustomer } from '@/app/actions/customers';
import { PageHeader, Card, Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { CA_PROVINCES } from '@/lib/tax';
import { useResolvedT } from '@/hooks/useResolvedLocale';

export default function NewCustomerForm() {
  const [state, formAction, isPending] = useActionState(createCustomer, {});
  const { t } = useResolvedT();

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={t('t10money.custNewTitle')}
        subtitle={t('t10money.custNewSubtitle')}
        actions={
          <Link href="/customers" className={secondaryBtnClass}>
            <ArrowLeft size={14} /> {t('t10money.custBack')}
          </Link>
        }
      />

      <Card className="p-6 md:p-8">
        <form action={formAction} className="space-y-5">
          <Field label={`${t('t10money.custName')} *`}>
            <input
              name="name"
              required
              placeholder={t('t10money.custNamePh')}
              autoComplete="name"
              className={inputClass}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label={t('t10money.custPhone')} hint={t('t10money.custPhoneHint')}>
              <input
                name="phone"
                type="tel"
                placeholder="+1 416 555 0100"
                autoComplete="tel"
                className={inputClass}
              />
            </Field>
            <Field label={t('t10money.custEmail')}>
              <input
                name="email"
                type="email"
                placeholder={t('t10money.custEmailPh')}
                autoComplete="email"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label={t('t10money.custAddress')}>
            <AddressAutocomplete
              name="address"
              rows={2}
              placeholder={t('t10money.custAddressPh')}
              className={inputClass}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label={t('t10money.custProvince')}>
              <select name="province" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {CA_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('t10money.custPostal')} hint={t('t10money.custPostalHint')}>
              <input
                name="postalCode"
                placeholder="M5V 2T6"
                autoComplete="postal-code"
                maxLength={7}
                className={inputClass + ' uppercase'}
              />
            </Field>
          </div>

          <Field label={t('t10money.custNotes')} hint={t('t10money.custNotesHint')}>
            <textarea
              name="notes"
              rows={3}
              placeholder={t('t10money.custNotesPh')}
              className={inputClass}
            />
          </Field>

          <Field label={t('t10money.custTags')} hint={t('t10money.custTagsHint')}>
            <input
              name="tags"
              placeholder="vip, senior"
              maxLength={400}
              className={inputClass}
            />
          </Field>

          {state?.error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <button type="submit" disabled={isPending} className={primaryBtnClass}>
            <UserPlus size={14} />
            {isPending ? t('t10money.custSaving') : t('t10money.custSave')}
          </button>
        </form>
      </Card>
    </div>
  );
}
