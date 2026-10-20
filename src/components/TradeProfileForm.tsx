'use client';

import { useState, useTransition } from 'react';
import { Save } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Button, Input, Select } from '@/components/kit';
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
        <Select
          label={tr('credentials.tradeLabel')}
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          options={[
            { value: '', label: tr('credentials.tradeUnset') },
            ...TRADE_KEYS.map((k) => ({ value: k, label: tr(`credentials.trades.${k}`) })),
          ]}
        />
        <Input
          label={tr('credentials.yearsLabel')}
          type="number"
          min={0}
          max={150}
          value={years}
          onChange={(e) => setYears(e.target.value)}
          placeholder="0"
        />
        <Input
          label={tr('credentials.specialtiesLabel')}
          value={specialties}
          onChange={(e) => setSpecialties(e.target.value)}
          placeholder={tr('credentials.specialtiesPh')}
          maxLength={400}
        />
      </div>
      <Button type="button" variant="primary" onClick={save} disabled={pending}>
        <Save size={14} /> {tr('credentials.saveProfile')}
      </Button>
    </div>
  );
}
