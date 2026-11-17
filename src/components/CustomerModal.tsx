'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, FileText, Mail, MapPin, Phone, UserRound, X } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { createCustomer, updateCustomer } from '@/app/actions/customers';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { CA_PROVINCES } from '@/lib/tax';
import { Input, Select, Textarea } from '@/components/kit';
import type { CustomerRow } from './CustomersClient';

/**
 * Add / Edit customer modal (Customers list redesign, ChatGPT Customers
 * prototype).
 *
 * The prototype's modal chrome — kicker, title, subtitle, close button —
 * wrapped around the REAL customer fields and the REAL create / update
 * server actions. No sample data, no fake persistence. Fields are
 * controlled (useState) so a failed save never wipes what the pro typed
 * (useActionState resets uncontrolled inputs on return). Escape and
 * backdrop clicks close the modal.
 */
export default function CustomerModal({
  customer,
  locale = 'en',
  onClose,
}: {
  /** Null = create a new customer; a row = edit that customer. */
  customer: CustomerRow | null;
  locale?: Locale;
  onClose: () => void;
}) {
  const custL = (k: string) => t(locale, `customers.${k}`);
  const router = useRouter();
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [province, setProvince] = useState(customer?.province ?? '');
  const [postalCode, setPostalCode] = useState(customer?.postalCode ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [tags, setTags] = useState((customer?.tags ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending) return;
    setError(null);
    const fd = new FormData();
    if (customer) fd.set('id', customer.id);
    fd.set('name', name.trim());
    fd.set('phone', phone.trim());
    fd.set('email', email.trim());
    fd.set('address', address.trim());
    fd.set('province', province);
    fd.set('postalCode', postalCode.trim());
    fd.set('notes', notes.trim());
    fd.set('tags', tags.trim());
    startTransition(async () => {
      try {
        const result = customer
          ? await updateCustomer({}, fd)
          : await createCustomer({}, fd);
        if (result?.error) {
          setError(result.error);
          return;
        }
        if (result?.ok) {
          toast.success(custL('customerUpdated'));
          onClose();
          // Same reason as the list archive (CustomersClient): a soft
          // navigation re-fetches the list, while router.refresh() here
          // raced and served stale snapshots in QA.
          router.replace('/customers');
        }
        // createCustomer redirects to /customers on success (navigation
        // is underway); nothing more to do here.
      } catch (err) {
        // A redirect thrown by the server action means the create
        // succeeded and the framework is navigating to /customers — that
        // navigation re-fetches the list, so do NOT call router.refresh()
        // here: a manual refresh racing the in-flight navigation left
        // the list showing stale data (QA runs 2-4: the new customer was
        // in the DB but invisible until a hard reload). Close the modal
        // and toast; the navigation does the rest.
        const digest = (err as { digest?: string })?.digest;
        if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
          if (!customer) toast.success(custL('customerAdded'));
          onClose();
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not save this customer.');
      }
    });
  };

  return (
    <div
      className="ej-customers-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="ej-customers-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-modal-title"
      >
        <header className="ej-customers-modal-heading">
          <div className="min-w-0">
            <span className="ej-customers-modal-kicker">
              {customer ? custL('modalEditKicker') : custL('modalAddKicker')}
            </span>
            <h2 id="customer-modal-title">
              {customer ? custL('modalEditTitle') : custL('modalAddTitle')}
            </h2>
            <p>{custL('modalSubtitle')}</p>
          </div>
          <button
            type="button"
            className="ej-customers-modal-close"
            onClick={onClose}
            aria-label={custL('cancel')}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <form onSubmit={submit}>
          <Input
            label={
              <span className="inline-flex items-center gap-1.5">
                <UserRound size={14} aria-hidden="true" /> {t(locale, 't10money.custName')} *
              </span>
            }
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(locale, 't10money.custNamePh')}
            required
            autoFocus
            autoComplete="name"
          />
          <div className="ej-customers-modal-grid">
            <Input
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={14} aria-hidden="true" /> {t(locale, 't10money.custPhone')}
                </span>
              }
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              hint={t(locale, 't10money.custPhoneHint')}
              autoComplete="tel"
            />
            <Input
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={14} aria-hidden="true" /> {t(locale, 't10money.custEmail')}
                </span>
              }
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t(locale, 't10money.custEmailPh')}
              autoComplete="email"
            />
          </div>
          <label className="field">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} aria-hidden="true" /> {t(locale, 't10money.custAddress')}
            </span>
            <AddressAutocomplete
              name="address"
              value={address}
              onChange={setAddress}
              placeholder={t(locale, 't10money.custAddressPh')}
              className="input"
            />
          </label>
          <div className="ej-customers-modal-grid">
            <Select
              label={t(locale, 't10money.custProvince')}
              name="province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              options={[
                { value: '', label: '-' },
                ...CA_PROVINCES.map((p) => ({ value: p.code, label: p.name })),
              ]}
            />
            <Input
              label={t(locale, 't10money.custPostal')}
              name="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              hint={t(locale, 't10money.custPostalHint')}
              autoComplete="postal-code"
              maxLength={7}
            />
          </div>
          <Textarea
            label={
              <span className="inline-flex items-center gap-1.5">
                <FileText size={14} aria-hidden="true" /> {t(locale, 't10money.custNotes')}
              </span>
            }
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t(locale, 't10money.custNotesPh')}
          />
          <Input
            label={t(locale, 't10money.custTags')}
            name="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            hint={t(locale, 't10money.custTagsHint')}
            maxLength={400}
          />
          {error && (
            <div className="ej-customers-modal-error" role="alert">
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <footer className="ej-customers-modal-actions">
            <button
              type="button"
              className="ej-customers-btn"
              onClick={onClose}
              disabled={isPending}
            >
              {custL('cancel')}
            </button>
            <button
              type="submit"
              className="ej-customers-btn primary"
              disabled={isPending || !name.trim()}
            >
              {isPending
                ? customer
                  ? custL('saving')
                  : custL('adding')
                : customer
                  ? custL('saveChanges')
                  : custL('addCustomer')}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
