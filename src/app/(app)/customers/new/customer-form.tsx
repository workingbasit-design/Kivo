'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, UserPlus } from 'lucide-react';
import { createCustomer } from '@/app/actions/customers';
import { PageHeader, Card, Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { CA_PROVINCES } from '@/lib/tax';

export default function NewCustomerForm() {
  const [state, formAction, isPending] = useActionState(createCustomer, {});

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Add customer"
        subtitle="Save a customer once, reuse them on every job."
        actions={
          <Link href="/customers" className={secondaryBtnClass}>
            <ArrowLeft size={14} /> Back
          </Link>
        }
      />

      <Card className="p-6 md:p-8">
        <form action={formAction} className="space-y-5">
          <Field label="Name *">
            <input
              name="name"
              required
              placeholder="e.g. Sarah Miller"
              autoComplete="name"
              className={inputClass}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Phone" hint="e.g. +1 416 555 0100">
              <input
                name="phone"
                type="tel"
                placeholder="+1 416 555 0100"
                autoComplete="tel"
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                placeholder="customer@example.com"
                autoComplete="email"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Address">
            <AddressAutocomplete
              name="address"
              rows={2}
              placeholder="Street / unit / city"
              className={inputClass}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Province">
              <select name="province" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {CA_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Postal code" hint="e.g. M5V 2T6">
              <input
                name="postalCode"
                placeholder="M5V 2T6"
                autoComplete="postal-code"
                maxLength={7}
                className={inputClass + ' uppercase'}
              />
            </Field>
          </div>

          <Field label="Notes" hint="Gate code, parking, preferences — anything useful on a visit.">
            <textarea
              name="notes"
              rows={3}
              placeholder="e.g. Call before arriving, 2nd floor, dog in house"
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
            {isPending ? 'Saving…' : 'Save customer'}
          </button>
        </form>
      </Card>
    </div>
  );
}
