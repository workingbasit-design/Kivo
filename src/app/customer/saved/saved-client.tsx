"use client";

import { useState } from 'react';
import { Heart } from '@/components/icons';
import { toggleSavePro } from '@/app/actions/customer-pros';
import { t, type Locale } from '@/lib/i18n';
import ProCard, { type ProCardData } from '@/components/ProCard';
import { Button, Chip, EmptyState } from '@/components/kit';

export default function SavedProsClient({ initialPros, locale }: { initialPros: ProCardData[]; locale: Locale }) {
  const tr = (path: string) => t(locale, path as never);
  const [pros, setPros] = useState(initialPros);
  const [saved, setSaved] = useState<Set<string>>(new Set(initialPros.map((p) => p.id)));

  const toggleSave = async (businessId: string) => {
    const next = new Set(saved);
    next.delete(businessId);
    setSaved(next);
    setPros(pros.filter((p) => p.id !== businessId));
    await toggleSavePro(businessId).catch(() => {
      setSaved(new Set(initialPros.map((p) => p.id)));
      setPros(initialPros);
    });
  };

  return (
    <div className="space-y-4">
      <div className="ej-anim-fade-up flex items-start justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink">{tr('customer.saved.title')}</h1>
        {pros.length > 0 && <Chip tone="neutral">{pros.length}</Chip>}
      </div>

      {pros.length === 0 ? (
        <>
          <EmptyState
            icon={<Heart />}
            title={tr('customer.saved.emptyTitle')}
            text={tr('customer.saved.emptyHint')}
          />
          <div className="text-center -mt-4 pb-2">
            <Button href="/customer" sm>
              {tr('customer.saved.findPro')}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {pros.map((pro, i) => (
            <div
              key={pro.id}
              className="ej-anim-fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <ProCard
                pro={pro}
                saved={saved.has(pro.id)}
                onToggleSave={toggleSave}
                locale={locale}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
