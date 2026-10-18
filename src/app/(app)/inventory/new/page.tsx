import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/kit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { ArrowLeft } from '@/components/icons';
import PartForm from '@/components/PartForm';
import { PageTitle } from '../../_components/PageTitle';

export const dynamic = 'force-dynamic';

export default async function NewPartPage() {
  const locale = await getLocale();
  const T = (k: string) => t(locale, `inventory.${k}`);

  return (
    <div className="space-y-5 max-w-2xl">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink min-h-[44px]"
      >
        <ArrowLeft size={16} /> {T('back')}
      </Link>
      <PageTitle title={T('add')} />
      <Card>
        <PartForm locale={locale} mode="create" />
      </Card>
    </div>
  );
}
