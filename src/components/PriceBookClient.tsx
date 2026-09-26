"use client";

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Clock, Plus, Search, Tag, Trash2, ListPlus, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { createService, deleteService, seedDefaultServices } from '@/app/actions/services';
import { currencySymbol, formatMoney } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import { Dialog, Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';

type Service = {
  id: string;
  name: string;
  price: number;
  durationMin: number | null;
  description: string | null;
};

export default function PriceBookClient({
  initialServices,
  currency,
  locale,
}: {
  initialServices: Service[];
  currency?: string;
  locale?: Locale;
}) {
  const loc: Locale = locale ?? 'en';
  const tr = (path: string) => t(loc, path);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const filteredServices = initialServices.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    const fd = new FormData();
    fd.append('name', name);
    fd.append('price', price);
    fd.append('durationMin', durationMin);
    fd.append('description', description);

    startTransition(async () => {
      setError(null);
      const res = await createService(fd);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setName('');
      setPrice('');
      setDurationMin('');
      setDescription('');
      setIsModalOpen(false);
      toast.success(tr('t10misc.pricebook.added'));
    });
  };

  const runDelete = () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (!id) return;
    startTransition(async () => {
      setError(null);
      const res = await deleteService(id);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(tr('t10misc.pricebook.removed'));
      }
    });
  };

  const handleSeed = () => {
    startTransition(async () => {
      setError(null);
      const res = await seedDefaultServices();
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(tr('t10misc.pricebook.added'));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)]">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            {tr('t10misc.pricebook.title')}
          </h1>
          <p className="text-zinc-500 mt-1">{tr('t10misc.pricebook.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {initialServices.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 min-h-[44px] rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm disabled:opacity-60"
            >
              <ListPlus size={14} /> {tr('t10misc.pricebook.addStandard')}
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-ink hover:bg-graphite text-white px-5 min-h-[44px] rounded-xl font-semibold text-sm transition-colors inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus size={16} /> {tr('t10misc.pricebook.addService')}
          </button>
        </div>
      </div>

      {/* Main Container */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="font-bold">{tr('t10misc.pricebook.errorPrefix')}</span>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-rose-400 hover:text-rose-600 font-bold min-w-[44px] min-h-[44px] inline-flex items-center justify-center -mr-2 -my-2"
            aria-label={tr('t10misc.pricebook.dismissError')}
          >
            ✕
          </button>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 p-6">
        {/* Search Bar */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder={tr('t10misc.pricebook.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={tr('t10misc.pricebook.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 min-h-[44px] bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink"
          />
        </div>

        {/* Services Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="p-5 border border-zinc-200 rounded-2xl hover:border-smoke hover:shadow-md transition-all group relative bg-white"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-xl bg-smoke text-ink flex items-center justify-center">
                  <Tag size={18} />
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-zinc-900">
                    {formatMoney(service.price, currency)}
                  </span>
                  <button
                    onClick={() => setPendingDeleteId(service.id)}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 text-rose-500 hover:text-rose-700 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-rose-50 rounded-lg transition-all"
                    title={tr('t10misc.pricebook.removeTitle')}
                    aria-label={`${tr('t10misc.pricebook.removeTitle')}: ${service.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-base text-zinc-900 mb-1">{service.name}</h3>
              {service.description ? (
                <p className="text-xs text-zinc-500 line-clamp-2 mb-2">{service.description}</p>
              ) : (
                <p className="text-xs text-zinc-500 mb-2">{tr('t10misc.pricebook.standardFlat')}</p>
              )}
              <div className="flex items-center justify-between gap-2 mt-1">
                {service.durationMin != null ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 bg-zinc-100 rounded-lg px-2 py-1">
                    <Clock size={11} /> {service.durationMin} min
                  </span>
                ) : (
                  <span />
                )}
                <Link
                  href={`/jobs/new?service=${service.id}`}
                  className="inline-flex items-center gap-1 min-h-[44px] text-[11px] font-bold text-ink hover:underline px-1"
                >
                  <Briefcase size={11} /> {tr('t10misc.pricebook.useInJob')}
                </Link>
              </div>
            </div>
          ))}

          {filteredServices.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-200 rounded-2xl text-center">
              <Tag size={40} className="text-zinc-300 mb-3" />
              {initialServices.length === 0 ? (
                <>
                  <h3 className="text-base font-bold text-zinc-900 mb-1">
                    {tr('t10misc.pricebook.noServicesTitle')}
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4 max-w-xs">
                    {tr('t10misc.pricebook.noServicesDesc')}
                  </p>

                  <button
                    onClick={handleSeed}
                    disabled={isPending}
                    className="bg-ink text-white px-4 min-h-[44px] rounded-xl text-xs font-semibold hover:bg-graphite transition-colors inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    <ListPlus size={14} /> {tr('t10misc.pricebook.seedButton')}
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-base font-bold text-zinc-900 mb-1">
                    {tr('t10misc.pricebook.noMatchTitle')}
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4 max-w-xs">
                    {tr('t10misc.pricebook.noMatchDesc')
                      .replace('{count}', String(initialServices.length))
                      .replace('{s}', initialServices.length === 1 ? '' : 's')}
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="bg-zinc-900 text-white px-4 min-h-[44px] rounded-xl text-xs font-semibold hover:bg-zinc-700 transition-colors"
                  >
                    {tr('t10misc.pricebook.clearSearch')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Service Dialog */}
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={tr('t10misc.pricebook.modalTitle')}
      >
        <p className="text-xs text-zinc-500 mb-6">{tr('t10misc.pricebook.modalDesc')}</p>

        <form onSubmit={handleAddService} className="space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
              {error}
            </div>
          )}
          <Field label={tr('t10misc.pricebook.serviceName')}>
            <input
              type="text"
              required
              placeholder={tr('t10misc.pricebook.serviceNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={tr('t10misc.pricebook.flatRate').replace('{symbol}', currencySymbol(currency))}
            >
              <input
                type="number"
                required
                placeholder={tr('t10misc.pricebook.flatRatePlaceholder')}
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={tr('t10misc.pricebook.duration')} hint={tr('t10misc.pricebook.durationHint')}>
              <input
                type="number"
                placeholder={tr('t10misc.pricebook.durationHint')}
                min={5}
                max={1440}
                step="1"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label={tr('t10misc.pricebook.description')} hint={tr('t10misc.pricebook.descriptionHint')}>
            <textarea
              placeholder={tr('t10misc.pricebook.descriptionHint')}
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={isPending}
              className={`${primaryBtnClass} flex-1 justify-center`}
            >
              {isPending ? tr('t10misc.pricebook.saving') : tr('t10misc.pricebook.save')}
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className={secondaryBtnClass}
            >
              {tr('t10misc.pricebook.keep')}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={tr('t10misc.pricebook.removeTitle')}
        message={tr('t10misc.pricebook.removeMessage')}
        confirmLabel={tr('t10misc.pricebook.removeConfirm')}
        cancelLabel={tr('t10misc.pricebook.keep')}
        busy={isPending}
        onConfirm={runDelete}
        onClose={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
