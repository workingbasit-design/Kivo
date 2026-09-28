'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { Card, Field } from '@/components/ui';
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
  ];

  return (
    <div className="space-y-4">
      <Card>
        <dl className="divide-y divide-zinc-100">
          <div className="py-3 flex items-center justify-between gap-4">
            <dt className="text-sm text-zinc-500">{T('customer')}</dt>
            <dd>
              <Link
                href={`/customers/${equipment.customerId}`}
                className="text-sm font-semibold text-lime-700 hover:text-lime-800"
              >
                {equipment.customerName}
              </Link>
            </dd>
          </div>
          {rows.map(
            ([label, value]) =>
              value && (
                <div key={label} className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-sm text-zinc-500">{label}</dt>
                  <dd className="text-sm font-medium text-zinc-900 text-right">{value}</dd>
                </div>
              )
          )}
        </dl>
        {equipment.notes && (
          <div className="mt-2 pt-3 border-t border-zinc-100">
            <p className="text-sm text-zinc-500 mb-1">{T('notes')}</p>
            <p className="text-sm text-zinc-900 whitespace-pre-wrap">{equipment.notes}</p>
          </div>
        )}
      </Card>

      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={deleting}
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 min-h-[44px]"
      >
        <Trash2 size={14} /> {deleting ? '…' : T('delete')}
      </button>
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
