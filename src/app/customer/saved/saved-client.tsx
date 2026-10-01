"use client";

import Link from 'next/link';
import { useState } from 'react';
import { Heart } from 'lucide-react';
import { toggleSavePro } from '@/app/actions/customer-pros';
import ProCard, { type ProCardData } from '@/components/ProCard';

export default function SavedProsClient({ initialPros }: { initialPros: ProCardData[] }) {
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Saved pros</h1>
        {pros.length > 0 && (
          <span className="text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full px-2.5 py-1">
            {pros.length}
          </span>
        )}
      </div>

      {pros.length === 0 ? (
        <div className="bg-white rounded-3xl border border-zinc-200/80 p-10 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7 text-rose-400" />
          </div>
          <p className="font-bold text-zinc-900">No saved pros yet</p>
          <p className="text-sm text-zinc-500 mt-1 mb-5 max-w-xs mx-auto">
            Tap the heart on any pro to keep them here for quick access later.
          </p>
          <Link
            href="/customer"
            className="inline-flex min-h-[48px] items-center px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/25"
          >
            Find a pro
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pros.map((pro) => (
            <ProCard
              key={pro.id}
              pro={pro}
              saved={saved.has(pro.id)}
              onToggleSave={toggleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
