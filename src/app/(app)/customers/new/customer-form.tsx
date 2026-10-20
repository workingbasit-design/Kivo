'use client';

import React, { useActionState } from 'react';
import { AlertCircle, ArrowLeft, UserPlus } from '@/components/icons';
import { createCustomer } from '@/app/actions/customers';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { CA_PROVINCES } from '@/lib/tax';
import { useResolvedT } from '@/hooks/useResolvedLocale';
import { Button, Card, Input, Select, Textarea } from '@/components/kit';
import { PageTitle } from '../../_components/PageTitle';

export default function NewCustomerForm() {
  const [state, formAction, isPending] = useActionState(createCustomer, {});
  const { t } = useResolvedT();

  return (
    <div className="space-y-6 max-w-2xl">
      <Button href="/customers" variant="secondary" className=" self-start">
        <ArrowLeft size={14} /> {t('t10money.custBack')}
      </Button>
      <PageTitle
        title={t('t10money.custNewTitle')}
        summary={t('t10money.custNewSubtitle')}
      />

      <Card className="p-6 md:p-8">
        <form action={formAction} className="space-y-5">
          <Input
            label={`${t('t10money.custName')} *`}
            name="name"
            required
            placeholder={t('t10money.custNamePh')}
            autoComplete="name"
          />

          <div className="grid sm:grid-cols-2 gap-5">
            <Input
              label={t('t10money.custPhone')}
              hint={t('t10money.custPhoneHint')}
              name="phone"
              type="tel"
              autoComplete="tel"
            />
            <Input
              label={t('t10money.custEmail')}
              name="email"
              type="email"
              placeholder={t('t10money.custEmailPh')}
              autoComplete="email"
            />
          </div>

          <label className="field">
            <span>{t('t10money.custAddress')}</span>
            <AddressAutocomplete
              name="address"
              rows={2}
              placeholder={t('t10money.custAddressPh')}
              className="input"
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-5">
            <Select
              label={t('t10money.custProvince')}
              name="province"
              defaultValue=""
              options={[
                { value: '', label: '-' },
                ...CA_PROVINCES.map((p) => ({ value: p.code, label: p.name })),
              ]}
            />
            <Input
              label={t('t10money.custPostal')}
              hint={t('t10money.custPostalHint')}
              name="postalCode"
              autoComplete="postal-code"
              maxLength={7}
            />
          </div>

          <Textarea
            label={t('t10money.custNotes')}
            hint={t('t10money.custNotesHint')}
            name="notes"
            rows={3}
            placeholder={t('t10money.custNotesPh')}
          />

          <Input
            label={t('t10money.custTags')}
            hint={t('t10money.custTagsHint')}
            name="tags"
            maxLength={400}
          />

          {state?.error && (
            <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <Button type="submit" variant="primary" disabled={isPending}>
            <UserPlus size={14} />
            {isPending ? t('t10money.custSaving') : t('t10money.custSave')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
