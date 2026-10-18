"use client";

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Clock, Plus, Search, Tag, Trash2, ListPlus, Briefcase, Pencil } from '@/components/icons';
import { toast } from 'sonner';
import { createService, updateService, deleteService, seedDefaultServices } from '@/app/actions/services';
import { currencySymbol, formatMoney } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import { BottomSheet, Button, Input, Textarea } from '@/components/kit';
import ConfirmDialog from '@/components/ConfirmDialog';
import TradeIcon from '@/components/TradeIcon';
import { TRADE_KEYS, tradeKeyForService, type TradeKey } from '@/lib/trade-icons';

type Service = {
  id: string;
  name: string;
  price: number;
  durationMin: number | null;
  description: string | null;
  iconKey: string | null;
};

/** i18n key per trade for the icon picker labels. */
const TRADE_LABEL_KEYS: Record<TradeKey, string> = {
  cleaning: 't10misc.pricebook.tradeCleaning',
  gutters: 't10misc.pricebook.tradeGutters',
  furnace: 't10misc.pricebook.tradeFurnace',
  windows: 't10misc.pricebook.tradeWindows',
  plumbing: 't10misc.pricebook.tradePlumbing',
  electrical: 't10misc.pricebook.tradeElectrical',
  landscaping: 't10misc.pricebook.tradeLandscaping',
  snow: 't10misc.pricebook.tradeSnow',
  painting: 't10misc.pricebook.tradePainting',
  general: 't10misc.pricebook.tradeGeneral',
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
  const [iconKey, setIconKey] = useState(''); // '' = auto-detect from name
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredServices = initialServices.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setDurationMin('');
    setDescription('');
    setIconKey('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditingId(service.id);
    setName(service.name);
    setPrice(String(service.price));
    setDurationMin(service.durationMin != null ? String(service.durationMin) : '');
    setDescription(service.description ?? '');
    setIconKey(service.iconKey ?? '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmitService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    const fd = new FormData();
    fd.append('name', name);
    fd.append('price', price);
    fd.append('durationMin', durationMin);
    fd.append('description', description);
    fd.append('iconKey', iconKey);

    startTransition(async () => {
      setError(null);
      const res = editingId
        ? await updateService(editingId, fd)
        : await createService(fd);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setName('');
      setPrice('');
      setDurationMin('');
      setDescription('');
      setIconKey('');
      setEditingId(null);
      setIsModalOpen(false);
      toast.success(tr(editingId ? 't10misc.pricebook.updated' : 't10misc.pricebook.added'));
    });
  };

  const handleAddService = handleSubmitService;

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-[20px] border border-line/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)]">
        <div>
          <h1 className="text-3xl font-bold text-ink tracking-tight">
            {tr('t10misc.pricebook.title')}
          </h1>
          <p className="text-ink-2 mt-1">{tr('t10misc.pricebook.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {initialServices.length === 0 && (
            <Button
              variant="secondary"
              sm
              onClick={handleSeed}
              disabled={isPending}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ListPlus size={14} /> {tr('t10misc.pricebook.addStandard')}
            </Button>
          )}

          <Button variant="primary" sm onClick={openAdd}>
            <Plus size={16} /> {tr('t10misc.pricebook.addService')}
          </Button>
        </div>
      </div>

      {/* Main Container */}
      {error && (
        <div className="bg-danger-bg border border-danger/25 text-danger text-xs font-medium rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="font-bold">{tr('t10misc.pricebook.errorPrefix')}</span>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-danger/60 hover:text-danger font-bold min-w-[44px] min-h-[44px] inline-flex items-center justify-center -mr-2 -my-2"
            aria-label={tr('t10misc.pricebook.dismissError')}
          >
            ✕
          </button>
        </div>
      )}
      <div className="bg-surface rounded-2xl shadow-sm border border-line/60 p-6">
        {/* Search Bar */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2" size={16} />
          <input
            type="text"
            placeholder={tr('t10misc.pricebook.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={tr('t10misc.pricebook.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 min-h-[44px] bg-surface-2 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-asphalt"
          />
        </div>

        {/* Services Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="p-5 border border-line rounded-2xl hover:border-smoke hover:shadow-md transition-all group relative bg-surface"
            >
              <div className="flex justify-between items-start mb-3">
                <TradeIcon trade={tradeKeyForService(service)} size={24} className="text-ink" />

                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-ink">
                    {formatMoney(service.price, currency)}
                  </span>
                  <button
                    onClick={() => openEdit(service)}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 text-ink-2 hover:text-ink min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-surface-2 rounded-lg transition-all"
                    title={tr('t10misc.pricebook.editTitle')}
                    aria-label={`${tr('t10misc.pricebook.editService')}: ${service.name}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setPendingDeleteId(service.id)}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 text-danger/70 hover:text-danger min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-danger-bg rounded-lg transition-all"
                    title={tr('t10misc.pricebook.removeTitle')}
                    aria-label={`${tr('t10misc.pricebook.removeTitle')}: ${service.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-base text-ink mb-1">{service.name}</h3>
              {service.description ? (
                <p className="text-xs text-ink-2 line-clamp-2 mb-2">{service.description}</p>
              ) : (
                <p className="text-xs text-ink-2 mb-2">{tr('t10misc.pricebook.standardFlat')}</p>
              )}
              <div className="flex items-center justify-between gap-2 mt-1">
                {service.durationMin != null ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-2 bg-surface-2 rounded-lg px-2 py-1">
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
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-ink-2 border-2 border-dashed border-line rounded-2xl text-center">
              <Tag size={40} className="text-line-strong mb-3" />
              {initialServices.length === 0 ? (
                <>
                  <h3 className="text-base font-bold text-ink mb-1">
                    {tr('t10misc.pricebook.noServicesTitle')}
                  </h3>
                  <p className="text-xs text-ink-2 mb-4 max-w-xs">
                    {tr('t10misc.pricebook.noServicesDesc')}
                  </p>

                  <Button
                    variant="primary"
                    sm
                    onClick={handleSeed}
                    disabled={isPending}
                    className="disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <ListPlus size={14} /> {tr('t10misc.pricebook.seedButton')}
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-base font-bold text-ink mb-1">
                    {tr('t10misc.pricebook.noMatchTitle')}
                  </h3>
                  <p className="text-xs text-ink-2 mb-4 max-w-xs">
                    {tr('t10misc.pricebook.noMatchDesc')
                      .replace('{count}', String(initialServices.length))
                      .replace('{s}', initialServices.length === 1 ? '' : 's')}
                  </p>
                  <Button variant="primary" sm onClick={() => setSearchQuery('')}>
                    {tr('t10misc.pricebook.clearSearch')}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Service sheet */}
      <BottomSheet
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={tr(editingId ? 't10misc.pricebook.modalEditTitle' : 't10misc.pricebook.modalTitle')}
      >
        <p className="text-xs text-ink-2 mb-6">{tr(editingId ? 't10misc.pricebook.modalEditDesc' : 't10misc.pricebook.modalDesc')}</p>

        <form onSubmit={handleAddService} className="space-y-4">
          {error && (
            <div className="bg-danger-bg border border-danger/25 text-danger text-xs font-medium rounded-xl px-3 py-2.5">
              {error}
            </div>
          )}
          <Input
            label={tr('t10misc.pricebook.serviceName')}
            type="text"
            required
            placeholder={tr('t10misc.pricebook.serviceNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={tr('t10misc.pricebook.flatRate').replace('{symbol}', currencySymbol(currency))}
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              required
              placeholder={tr('t10misc.pricebook.flatRatePlaceholder')}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Input
              label={tr('t10misc.pricebook.duration')}
              hint={tr('t10misc.pricebook.durationHint')}
              type="number"
              placeholder={tr('t10misc.pricebook.durationHint')}
              min={5}
              max={1440}
              step="1"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </div>

          <Textarea
            label={tr('t10misc.pricebook.description')}
            hint={tr('t10misc.pricebook.descriptionHint')}
            placeholder={tr('t10misc.pricebook.descriptionHint')}
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Part B: trade icon picker. Auto (blank) detects from the name. */}
          <div>
            <span className="block text-xs font-semibold text-ink mb-1.5" id="trade-icon-label">
              {tr('t10misc.pricebook.tradeIconLabel')}
            </span>
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-labelledby="trade-icon-label">
              <button
                type="button"
                role="radio"
                aria-checked={iconKey === ''}
                title={tr('t10misc.pricebook.tradeIconAuto')}
                onClick={() => setIconKey('')}
                className={`min-h-[52px] rounded-xl border flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${iconKey === '' ? 'border-asphalt bg-asphalt text-hero-ink' : 'border-line text-ink-2 hover:bg-surface-2'}`}
              >
                <span className="text-sm font-bold">A</span>
                {tr('t10misc.pricebook.tradeIconAuto')}
              </button>
              {TRADE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={iconKey === key}
                  title={tr(TRADE_LABEL_KEYS[key])}
                  onClick={() => setIconKey(key)}
                  className={`min-h-[52px] rounded-xl border flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${iconKey === key ? 'border-asphalt bg-asphalt text-hero-ink' : 'border-line text-ink-2 hover:bg-surface-2'}`}
                >
                  <TradeIcon trade={key} size={20} />
                  <span className="max-w-full truncate px-0.5">{tr(TRADE_LABEL_KEYS[key])}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-2 mt-1">{tr('t10misc.pricebook.tradeIconHint')}</p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              variant="primary"
              type="submit"
              disabled={isPending}
              className="flex-1 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? tr('t10misc.pricebook.saving') : tr(editingId ? 't10misc.pricebook.saveChanges' : 't10misc.pricebook.save')}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {tr('t10misc.pricebook.keep')}
            </Button>
          </div>
        </form>
      </BottomSheet>

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
