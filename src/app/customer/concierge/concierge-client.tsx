'use client';

import { useState } from 'react';
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
} from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import {
  matchConciergePros,
  sendConciergeRequests,
  type ConciergePro,
} from '@/app/actions/concierge';
import { buildConciergeMessage } from '@/lib/concierge';
import { Button, Card, Textarea } from '@/components/kit';

type Step = 'describe' | 'match' | 'preview' | 'done';

/**
 * "Get it done for me" flow.
 * 1. Describe - job description + editable name/phone/city (prefilled).
 * 2. Match - up to 3 verified pros, all selected by default.
 * 3. Preview - exact recipients, exact message, details shared. One tap sends.
 * 4. Done - confirmation + link to Requests.
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
      // One idempotency key per match session - generated here, used at send.
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

  return (
    <div className="ej-anim-fade-up">
      {/* Header + step indicator */}
      <div className="flex items-center gap-3 mb-5">
        {step !== 'describe' && step !== 'done' && (
          <button
            onClick={() => setStep(step === 'preview' ? 'match' : 'describe')}
            aria-label={tr('customer.concierge.back')}
            className="w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center text-ink-2 active:scale-95"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-[22px] font-bold text-ink tracking-tight flex items-center gap-2">
            <Sparkles size={20} className="text-ink" />
            {tr('customer.concierge.title')}
          </h1>
          <p className="text-[13px] text-ink-2 mt-0.5">
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
                i <= stepIndex ? 'bg-ink' : 'bg-line'
              }`}
            />
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-2xl bg-danger-bg border border-line px-4 py-3 text-[14px] font-medium text-danger"
        >
          {error}
        </div>
      )}

      {/* STEP 1 - describe */}
      {step === 'describe' && (
        <div className="space-y-4">
          <Textarea
            label={tr('customer.concierge.describeLabel')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr('customer.concierge.describePlaceholder')}
            rows={4}
            maxLength={1000}
            hint={tr('customer.concierge.describeHint')}
          />
          <div className="grid grid-cols-1 gap-3">
            <label className="relative block">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2 z-10" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr('customer.concierge.nameLabel')}
                maxLength={100}
                aria-label={tr('customer.concierge.nameLabel')}
                className="input !pl-11"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="relative block">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2 z-10" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={tr('customer.concierge.phoneLabel')}
                  maxLength={25}
                  inputMode="tel"
                  aria-label={tr('customer.concierge.phoneLabel')}
                  className="input !pl-11"
                />
              </label>
              <label className="relative block">
                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2 z-10" />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={tr('customer.concierge.cityLabel')}
                  maxLength={100}
                  aria-label={tr('customer.concierge.cityLabel')}
                  className="input !pl-11"
                />
              </label>
            </div>
          </div>
          <Button onClick={doFindPros} disabled={busy} block>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {busy ? tr('customer.concierge.findingPros') : tr('customer.concierge.findPros')}
          </Button>
        </div>
      )}

      {/* STEP 2 - match */}
      {step === 'match' && (
        <div>
          {pros.length === 0 ? (
            <Card className="p-8 text-center">
              <span className="mx-auto w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                <SearchX size={26} className="text-ink-2" />
              </span>
              <h2 className="text-[17px] font-bold text-ink mb-2">
                {tr('customer.concierge.noMatchTitle')}
              </h2>
              <p className="text-[14px] text-ink-2 mb-6">
                {tr('customer.concierge.noMatchHint')
                  .replace('{service}', serviceLabel)
                  .replace('{city}', city.trim())}
              </p>
              <Button variant="secondary" onClick={() => setStep('describe')}>
                {tr('customer.concierge.tryAgain')}
              </Button>
            </Card>
          ) : (
            <>
              <h2 className="text-[16px] font-bold text-ink mb-1">
                {tr('customer.concierge.matchedTitle').replace('{service}', serviceLabel)}
              </h2>
              <p className="text-[13px] text-ink-2 mb-4">{tr('customer.concierge.matchedHint')}</p>
              <div className="space-y-2.5 mb-6">
                {pros.map((p) => {
                  const checked = selected.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePro(p.id)}
                      aria-pressed={checked}
                      className={`w-full text-left rounded-2xl border p-4 flex items-center gap-3.5 transition-all active:scale-[0.98] min-h-[44px] ${
                        checked
                          ? 'border-ink bg-surface shadow-[inset_0_0_0_1px_var(--ink)]'
                          : 'bg-surface border-line'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                          checked ? 'bg-ink border-ink' : 'border-line-strong bg-surface'
                        }`}
                      >
                        {checked && <Check size={14} className="text-surface" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-bold text-ink truncate">
                          {p.name}
                        </span>
                        <span className="block text-[12px] text-ink-2 truncate">
                          {[p.locality, p.serviceNames.slice(0, 2).join(' · ')]
                            .filter(Boolean)
                            .join(' - ')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={() => setStep('preview')}
                disabled={selected.size === 0}
                block
              >
                {tr('customer.concierge.continue')}
                <ArrowRight size={18} />
              </Button>
            </>
          )}
        </div>
      )}

      {/* STEP 3 - preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[16px] font-bold text-ink mb-1">
              {tr('customer.concierge.previewTitle')}
            </h2>
            <p className="text-[13px] text-ink-2">{tr('customer.concierge.previewHint')}</p>
          </div>

          <Card className="p-4">
            <h3 className="text-[13px] font-bold text-ink-2 mb-2.5">
              {tr('customer.concierge.sendingTo')} ({selected.size})
            </h3>
            <ul className="space-y-1.5">
              {pros
                .filter((p) => selected.has(p.id))
                .map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                    <CheckCircle2 size={16} className="text-ok shrink-0" />
                    {p.name}
                  </li>
                ))}
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="text-[13px] font-bold text-ink-2 mb-2.5">
              {tr('customer.concierge.exactMessage')}
            </h3>
            <p className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed">
              {previewMessage}
            </p>
          </Card>

          <Card className="p-4 bg-surface-2">
            <h3 className="text-[13px] font-bold text-ink-2 mb-2.5">
              {tr('customer.concierge.detailsShared')}
            </h3>
            <dl className="text-[14px] space-y-1">
              <div className="flex gap-2">
                <dt className="text-ink-2 w-20 shrink-0">{tr('customer.concierge.nameLabel')}</dt>
                <dd className="font-semibold text-ink">{name.trim()}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-2 w-20 shrink-0">{tr('customer.concierge.phoneLabel')}</dt>
                <dd className="font-semibold text-ink">{phone.trim()}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-2 w-20 shrink-0">{tr('customer.concierge.cityLabel')}</dt>
                <dd className="font-semibold text-ink">{city.trim()}</dd>
              </div>
            </dl>
          </Card>

          <Button onClick={doSend} disabled={busy} block>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {busy ? tr('customer.concierge.sending') : tr('customer.concierge.sendRequests')}
          </Button>
        </div>
      )}

      {/* STEP 4 - done */}
      {step === 'done' && (
        <Card className="p-8 text-center">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-ok-bg flex items-center justify-center mb-4">
            <CheckCircle2 size={28} className="text-ok" />
          </span>
          <h2 className="text-[19px] font-bold text-ink mb-2">
            {tr('customer.concierge.sentTitle')}
          </h2>
          <p className="text-[14px] text-ink-2 mb-2">{tr('customer.concierge.sentHint')}</p>
          {sentNames.length > 0 && (
            <p className="text-[13px] text-ink-2 mb-6">
              {sentNames.join(' · ')}
            </p>
          )}
          <div className="space-y-2.5">
            <Button href="/customer/requests" block>
              {tr('customer.concierge.viewRequests')}
            </Button>
            <Button variant="secondary" onClick={restart} block>
              {tr('customer.concierge.startOver')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
