import React from 'react';
import Link from 'next/link';
import { PageHeader, Card } from '@/components/ui';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { ArrowLeft } from 'lucide-react';
import PartForm from '@/components/PartForm';

export const dynamic = 'force-dynamic';

export default async function NewPartPage() {
  const locale = await getLocale();
  const T = (k: string) => t(locale, `inventory.${k}`);

  return (
    <div className="space-y-5 max-w-2xl">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 min-h-[44px]"
      >
        <ArrowLeft size={16} /> {T('back')}
      </Link>
      <PageHeader title={T('add')} />
      <Card>
        <PartForm locale={locale} mode="create" />
      </Card>
    </div>
  );
}
