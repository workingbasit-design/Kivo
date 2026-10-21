'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2 } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { localeMoneyTag } from '@/lib/utils';
import { Button, Card } from '@/components/kit';
import ConfirmDialog from '@/components/ConfirmDialog';
import { deleteEquipment } from '@/app/actions/equipment';

export default function EquipmentDetailClient({
  equipment,
  locale,
}: {
  equipment: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    serial: string | null;
    installDate: string | null;
    purchaseCostCents: number | null;
    notes: string | null;
    customerId: string;
    customerName: string;
  };
  locale: Locale;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const T = (k: string) => t(locale, `equipment.${k}`);

  const onDelete = async () => {
    setConfirming(false);
    setDeleting(true);
    const res = await deleteEquipment(equipment.id);
    if (res.ok) {
      router.push('/equipment');
    } else {
      alert(res.error ?? 'Error');
      setDeleting(false);
    }
  };

  const rows: [string, string | null][] = [
    [T('brand'), equipment.brand],
    [T('model'), equipment.model],
    [T('serial'), equipment.serial],
    [T('installDate'), equipment.installDate],
    // D5: purchase cost shows only when one was recorded.
    [
      T('purchaseCost'),
      equipment.purchaseCostCents != null
        ? formatMoney(equipment.purchaseCostCents / 100, 'CAD', localeMoneyTag(locale))
        : null,
    ],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <dl className="divide-y divide-line">
          <div className="py-3 flex items-center justify-between gap-4">
            <dt className="text-sm text-ink-2">{T('customer')}</dt>
            <dd>
              <Link
                href={`/customers/${equipment.customerId}`}
                className="text-sm font-semibold text-info hover:opacity-80"
              >
                {equipment.customerName}
              </Link>
            </dd>
          </div>
          {rows.map(
            ([label, value]) =>
              value && (
                <div key={label} className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-sm text-ink-2">{label}</dt>
                  <dd className="text-sm font-medium text-ink text-right">{value}</dd>
                </div>
              )
          )}
        </dl>
        {equipment.notes && (
          <div className="mt-2 pt-3 border-t border-line">
            <p className="text-sm text-ink-2 mb-1">{T('notes')}</p>
            <p className="text-sm text-ink whitespace-pre-wrap">{equipment.notes}</p>
          </div>
        )}
      </Card>

      <Button
        variant="danger"
        type="button"
        onClick={() => setConfirming(true)}
        disabled={deleting}
        className="disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Trash2 size={14} /> {deleting ? '…' : T('delete')}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={T('deleteConfirmTitle')}
        message={T('deleteConfirm')}
        busy={deleting}
        onConfirm={onDelete}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
