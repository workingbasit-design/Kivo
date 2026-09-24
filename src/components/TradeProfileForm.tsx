'use client';

import { useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Field, inputClass, primaryBtnClass, selectClass } from '@/components/ui';
import { updateTradeProfile } from '@/app/actions/designations';
import { TRADE_KEYS } from '@/lib/certifications';

export default function TradeProfileForm({
  locale,
  initial,
}: {
  locale: Locale;
  initial: { trade: string; yearsInBusiness: number | null; specialties: string };
}) {
  const tr = (p: string) => t(locale, p);
  const [trade, setTrade] = useState(initial.trade);
  const [years, setYears] = useState(initial.yearsInBusiness == null ? '' : String(initial.yearsInBusiness));
  const [specialties, setSpecialties] = useState(initial.specialties);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const yearsNum = years.trim() === '' ? null : Number(years);
      const res = await updateTradeProfile({
        trade,
        yearsInBusiness: yearsNum,
        specialties: specialties
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(tr('credentials.profileSaved'));
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label={tr('credentials.tradeLabel')}>
          <select value={trade} onChange={(e) => setTrade(e.target.value)} className={selectClass}>
            <option value="">{tr('credentials.tradeUnset')}</option>
            {TRADE_KEYS.map((k) => (
              <option key={k} value={k}>
                {tr(`credentials.trades.${k}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tr('credentials.yearsLabel')}>
          <input
            type="number"
            min={0}
            max={150}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className={inputClass}
            placeholder="0"
          />
        </Field>
        <Field label={tr('credentials.specialtiesLabel')}>
          <input
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            className={inputClass}
            placeholder={tr('credentials.specialtiesPh')}
            maxLength={400}
          />
        </Field>
      </div>
      <button type="button" onClick={save} disabled={pending} className={primaryBtnClass}>
        <Save size={14} /> {tr('credentials.saveProfile')}
      </button>
    </div>
  );
}
