'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  SearchX,
  Send,
  Sparkles,
  User,
  Phone,
  MapPin,
} from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import {
  matchConciergePros,
  sendConciergeRequests,
  type ConciergePro,
} from '@/app/actions/concierge';
import { buildConciergeMessage } from '@/lib/concierge';

type Step = 'describe' | 'match' | 'preview' | 'done';

/**
 * "Get it done for me" flow.
 * 1. Describe — job description + editable name/phone/city (prefilled).
 * 2. Match — up to 3 verified pros, all selected by default.
 * 3. Preview — exact recipients, exact message, details shared. One tap sends.
 * 4. Done — confirmation + link to Requests.
 *
 * The idempotency key is generated ONCE when the preview is shown and reused
 * for the send, so double-taps and retries never duplicate requests.
 */
export default function ConciergeClient({
  locale,
  initialName,
  initialPhone,
  initialCity,
}: {
  locale: Locale;
  initialName: string;
  initialPhone: string;
  initialCity: string;
}) {
  const tr = (path: string) => t(locale, path as never);

  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [city, setCity] = useState(initialCity);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serviceLabel, setServiceLabel] = useState('');
  const [pros, setPros] = useState<ConciergePro[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [sentNames, setSentNames] = useState<string[]>([]);

  const stepIndex = { describe: 0, match: 1, preview: 2, done: 3 }[step];

  async function doFindPros() {
    setError(null);
    if (description.trim().length < 10) {
      setError(tr('customer.concierge.describeHint'));
      return;
    }
    setBusy(true);
    try {
      const res = await matchConciergePros(description, city);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setServiceLabel(res.serviceLabel);
      setPros(res.pros);
      setSelected(new Set(res.pros.map((p) => p.id)));
      // One idempotency key per match session — generated here, used at send.
      setIdempotencyKey(
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `ck_${Date.now()}_${Math.random().toString(36).slice(2)}`
      );
      setStep('match');
    } finally {
      setBusy(false);
    }
  }

  function togglePro(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const previewMessage = buildConciergeMessage({
    serviceLabel,
    description,
    name,
    phone,
    city,
    locale: locale === 'fr' ? 'fr' : 'en',
  });

  async function doSend() {
    setError(null);
    setBusy(true);
    try {
      const res = await sendConciergeRequests({
        idempotencyKey,
        businessIds: [...selected],
        serviceLabel,
        description,
        name,
        phone,
        city,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSentNames(res.businessNames);
      setStep('done');
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setStep('describe');
    setDescription('');
    setPros([]);
    setSelected(new Set());
    setSentNames([]);
    setError(null);
  }

  const inputCls =
    'w-full min-h-[52px] rounded-2xl bg-white border border-zinc-200 px-4 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none shadow-sm transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';
  const btnPrimary =
    'min-h-[52px] px-6 rounded-2xl bg-indigo-600 text-white text-[15px] font-bold shadow-sm shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2';
  const btnGhost =
    'min-h-[52px] px-5 rounded-2xl bg-white border border-zinc-200 text-[15px] font-semibold text-zinc-700 transition-all hover:border-zinc-300 active:scale-[0.97] flex items-center justify-center gap-2';

  return (
    <div className="ej-anim-fade-up">
      {/* Header + step indicator */}
      <div className="flex items-center gap-3 mb-5">
        {step !== 'describe' && step !== 'done' && (
          <button
            onClick={() => setStep(step === 'preview' ? 'match' : 'describe')}
            aria-label={tr('customer.concierge.back')}
            className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 active:scale-95"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Sparkles size={20} className="text-indigo-600" />
            {tr('customer.concierge.title')}
          </h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">
            {tr(
              stepIndex === 0
                ? 'customer.concierge.stepDescribe'
                : stepIndex === 1
                  ? 'customer.concierge.stepMatch'
                  : stepIndex === 2
                    ? 'customer.concierge.stepPreview'
                    : 'customer.concierge.sentTitle'
            )}
          </p>
        </div>
      </div>

      {/* Step dots */}
      {step !== 'done' && (
        <div className="flex gap-1.5 mb-6" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-indigo-600' : 'bg-zinc-200'
              }`}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-[14px] text-rose-800">
          {error}
        </div>
      )}

      {/* STEP 1 — describe */}
      {step === 'describe' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="cj-desc" className="block text-[14px] font-semibold text-zinc-800 mb-1.5">
              {tr('customer.concierge.describeLabel')}
            </label>
            <textarea
              id="cj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr('customer.concierge.describePlaceholder')}
              rows={4}
              maxLength={1000}
              className={`${inputCls} py-3.5 resize-none`}
            />
            <p className="text-[12px] text-zinc-500 mt-1.5">{tr('customer.concierge.describeHint')}</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <label className="relative block">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr('customer.concierge.nameLabel')}
                maxLength={100}
                aria-label={tr('customer.concierge.nameLabel')}
                className={`${inputCls} pl-11`}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="relative block">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={tr('customer.concierge.phoneLabel')}
                  maxLength={25}
                  inputMode="tel"
                  aria-label={tr('customer.concierge.phoneLabel')}
                  className={`${inputCls} pl-11`}
                />
              </label>
              <label className="relative block">
                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={tr('customer.concierge.cityLabel')}
                  maxLength={100}
                  aria-label={tr('customer.concierge.cityLabel')}
                  className={`${inputCls} pl-11`}
                />
              </label>
            </div>
          </div>
          <button onClick={doFindPros} disabled={busy} className={`${btnPrimary} w-full`}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {busy ? tr('customer.concierge.findingPros') : tr('customer.concierge.findPros')}
          </button>
        </div>
      )}

      {/* STEP 2 — match */}
      {step === 'match' && (
        <div>
          {pros.length === 0 ? (
            <div className="rounded-3xl bg-white border border-zinc-200/80 shadow-sm p-8 text-center">
              <span className="mx-auto w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                <SearchX size={26} className="text-zinc-500" />
              </span>
              <h2 className="text-[17px] font-bold text-zinc-900 mb-2">
                {tr('customer.concierge.noMatchTitle')}
              </h2>
              <p className="text-[14px] text-zinc-600 mb-6">
                {tr('customer.concierge.noMatchHint')
                  .replace('{service}', serviceLabel)
                  .replace('{city}', city.trim())}
              </p>
              <button onClick={() => setStep('describe')} className={btnGhost}>
                {tr('customer.concierge.tryAgain')}
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-[16px] font-bold text-zinc-900 mb-1">
                {tr('customer.concierge.matchedTitle').replace('{service}', serviceLabel)}
              </h2>
              <p className="text-[13px] text-zinc-500 mb-4">{tr('customer.concierge.matchedHint')}</p>
              <div className="space-y-2.5 mb-6">
                {pros.map((p) => {
                  const checked = selected.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePro(p.id)}
                      aria-pressed={checked}
                      className={`w-full text-left rounded-2xl border p-4 flex items-center gap-3.5 transition-all active:scale-[0.98] ${
                        checked
                          ? 'bg-indigo-50/60 border-indigo-300 shadow-sm'
                          : 'bg-white border-zinc-200'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                          checked ? 'bg-indigo-600 border-indigo-600' : 'border-zinc-300 bg-white'
                        }`}
                      >
                        {checked && <Check size={14} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-bold text-zinc-900 truncate">
                          {p.name}
                        </span>
                        <span className="block text-[12px] text-zinc-500 truncate">
                          {[p.locality, p.serviceNames.slice(0, 2).join(' · ')]
                            .filter(Boolean)
                            .join(' — ')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setStep('preview')}
                disabled={selected.size === 0}
                className={`${btnPrimary} w-full`}
              >
                {tr('customer.concierge.continue')}
                <ArrowRight size={18} />
              </button>
            </>
          )}
        </div>
      )}

      {/* STEP 3 — preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[16px] font-bold text-zinc-900 mb-1">
              {tr('customer.concierge.previewTitle')}
            </h2>
            <p className="text-[13px] text-zinc-500">{tr('customer.concierge.previewHint')}</p>
          </div>

          <div className="rounded-2xl bg-white border border-zinc-200/80 shadow-sm p-4">
            <h3 className="text-[13px] font-bold text-zinc-500 uppercase tracking-wide mb-2.5">
              {tr('customer.concierge.sendingTo')} ({selected.size})
            </h3>
            <ul className="space-y-1.5">
              {pros
                .filter((p) => selected.has(p.id))
                .map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-[14px] font-semibold text-zinc-800">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    {p.name}
                  </li>
                ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-white border border-zinc-200/80 shadow-sm p-4">
            <h3 className="text-[13px] font-bold text-zinc-500 uppercase tracking-wide mb-2.5">
              {tr('customer.concierge.exactMessage')}
            </h3>
            <p className="text-[14px] text-zinc-800 whitespace-pre-wrap leading-relaxed">
              {previewMessage}
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-50 border border-zinc-200/80 p-4">
            <h3 className="text-[13px] font-bold text-zinc-500 uppercase tracking-wide mb-2.5">
              {tr('customer.concierge.detailsShared')}
            </h3>
            <dl className="text-[14px] space-y-1">
              <div className="flex gap-2">
                <dt className="text-zinc-500 w-20 shrink-0">{tr('customer.concierge.nameLabel')}</dt>
                <dd className="font-semibold text-zinc-800">{name.trim()}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-zinc-500 w-20 shrink-0">{tr('customer.concierge.phoneLabel')}</dt>
                <dd className="font-semibold text-zinc-800">{phone.trim()}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-zinc-500 w-20 shrink-0">{tr('customer.concierge.cityLabel')}</dt>
                <dd className="font-semibold text-zinc-800">{city.trim()}</dd>
              </div>
            </dl>
          </div>

          <button onClick={doSend} disabled={busy} className={`${btnPrimary} w-full`}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {busy ? tr('customer.concierge.sending') : tr('customer.concierge.sendRequests')}
          </button>
        </div>
      )}

      {/* STEP 4 — done */}
      {step === 'done' && (
        <div className="rounded-3xl bg-white border border-zinc-200/80 shadow-sm p-8 text-center">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </span>
          <h2 className="text-[19px] font-bold text-zinc-900 mb-2">
            {tr('customer.concierge.sentTitle')}
          </h2>
          <p className="text-[14px] text-zinc-600 mb-2">{tr('customer.concierge.sentHint')}</p>
          {sentNames.length > 0 && (
            <p className="text-[13px] text-zinc-500 mb-6">
              {sentNames.join(' · ')}
            </p>
          )}
          <div className="space-y-2.5">
            <Link href="/customer/requests" className={`${btnPrimary} w-full`}>
              {tr('customer.concierge.viewRequests')}
            </Link>
            <button onClick={restart} className={`${btnGhost} w-full`}>
              {tr('customer.concierge.startOver')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
