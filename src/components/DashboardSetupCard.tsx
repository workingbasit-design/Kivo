"use client";

import React, { useState } from 'react';
import { CheckCircle2, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import FinishSetupModal from './FinishSetupModal';

export default function DashboardSetupCard({ initialCompleted = false }: { initialCompleted?: boolean }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(initialCompleted);

  return (
    <>
      <div className={`rounded-3xl p-6 border shadow-sm relative overflow-hidden transition-all ${
        isCompleted 
          ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200' 
          : 'bg-paper border-smoke'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
              isCompleted ? 'text-emerald-700' : 'text-zinc-400'
            }`}>
              {isCompleted ? '100% Ready' : '10 minutes to ready'}
            </p>
            <h2 className="text-lg font-bold text-zinc-900">
              {isCompleted ? 'Workspace Fully Setup!' : 'Setup check'}
            </h2>
          </div>
          {isCompleted && (
            <span className="bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
              ACTIVE
            </span>
          )}
        </div>

        <div className="space-y-3 mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-[#2b243b] text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={10} />
            </div>
            <span className="text-xs font-semibold text-zinc-900">Business details added</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-[#2b243b] text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={10} />
            </div>
            <span className="text-xs font-semibold text-zinc-900">Price book ready</span>
          </div>

          <div className={`flex items-center gap-3 transition-all ${isCompleted ? 'opacity-100' : 'opacity-60'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              isCompleted ? 'bg-emerald-600 text-white' : 'border border-zinc-300'
            }`}>
              {isCompleted && <CheckCircle2 size={10} />}
            </div>
            <span className={`text-xs ${isCompleted ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'}`}>
              WhatsApp reply turned on
            </span>
          </div>

          <div className={`flex items-center gap-3 transition-all ${isCompleted ? 'opacity-100' : 'opacity-60'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              isCompleted ? 'bg-emerald-600 text-white' : 'border border-zinc-300'
            }`}>
              {isCompleted && <CheckCircle2 size={10} />}
            </div>
            <span className={`text-xs ${isCompleted ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'}`}>
              Team availability configured
            </span>
          </div>
        </div>

        {isCompleted ? (
          <div className="bg-white/80 p-3 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>All systems operational. Your business is receiving inquiries.</span>
          </div>
        ) : (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-ink hover:bg-graphite transition-colors text-white py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 relative z-10 cursor-pointer shadow-sm"
          >
            Finish setup <ArrowRight size={14} />
          </button>
        )}
      </div>

      <FinishSetupModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCompleted={() => setIsCompleted(true)}
      />
    </>
  );
}
