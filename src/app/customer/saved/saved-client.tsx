"use client";

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { toggleSavePro } from '@/app/actions/customer-pros';
import { t, type Locale } from '@/lib/i18n';
import ProCard, { type ProCardData } from '@/components/ProCard';
import {
  EmptyState,
  PageHeader,
  PrimaryCTA,
  Stagger,
} from '@/components/customer/ui';

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
      <PageHeader
        title={tr('customer.saved.title')}
        action={
          pros.length > 0 ? (
            <span className="text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full px-2.5 py-1">
              {pros.length}
            </span>
          ) : undefined
        }
      />

      {pros.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={tr('customer.saved.emptyTitle')}
          hint={tr('customer.saved.emptyHint')}
          delay={80}
          action={
            <PrimaryCTA href="/customer">{tr('customer.saved.findPro')}</PrimaryCTA>
          }
        />
      ) : (
        <div className="space-y-3">
          {pros.map((pro, i) => (
            <Stagger key={pro.id} index={i}>
              <ProCard
                pro={pro}
                saved={saved.has(pro.id)}
                onToggleSave={toggleSave}
                locale={locale}
              />
            </Stagger>
          ))}
        </div>
      )}
    </div>
  );
}
