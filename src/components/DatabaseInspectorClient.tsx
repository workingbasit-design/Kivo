"use client";

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Database, Sparkles, CheckCircle2, ArrowRight, Server, Briefcase, FileText, Users, Tag, MessageSquare, Activity } from 'lucide-react';
import { seedFullDatabase } from '@/app/actions/seed';

type Summary = {
  customersCount: number;
  jobsCount: number;
  invoicesCount: number;
  quotesCount: number;
  servicesCount: number;
  usersCount: number;
  communicationsCount: number;
  leadsCount: number;
};

export default function DatabaseInspectorClient({ summary }: { summary: Summary }) {
  const [isPending, startTransition] = useTransition();
  const [seededStatus, setSeededStatus] = useState<string | null>(null);

  const handleSeed = () => {
    startTransition(async () => {
      const res = await seedFullDatabase();
      setSeededStatus(res.message);
    });
  };

  const tables = [
    { name: 'Jobs Pipeline', count: summary.jobsCount, icon: Briefcase, color: 'text-purple-600 bg-purple-50 border-purple-100', href: '/jobs' },
    { name: 'Schedule Appointments', count: summary.jobsCount, icon: Server, color: 'text-indigo-600 bg-indigo-50 border-indigo-100', href: '/schedule' },
    { name: 'Customer Profiles', count: summary.customersCount, icon: Users, color: 'text-blue-600 bg-blue-50 border-blue-100', href: '/customers' },
    { name: 'Invoices & Payments', count: summary.invoicesCount, icon: FileText, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', href: '/invoices' },
    { name: 'Quotes & Estimates', count: summary.quotesCount, icon: FileText, color: 'text-amber-600 bg-amber-50 border-amber-100', href: '/quotes' },
    { name: 'Price Book Services', count: summary.servicesCount, icon: Tag, color: 'text-teal-600 bg-teal-50 border-teal-100', href: '/pricebook' },
    { name: 'Team Members & Staff', count: summary.usersCount, icon: Users, color: 'text-zinc-700 bg-zinc-100 border-zinc-200', href: '/settings/team' },
    { name: 'Recovery Queue Leads', count: summary.communicationsCount + summary.leadsCount, icon: Activity, color: 'text-rose-600 bg-rose-50 border-rose-100', href: '/leads' }
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-[#1a1525] text-white p-8 rounded-3xl shadow-xl border border-[#2b243b] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#6329d4]/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-emerald-400 border border-white/20">
            <Database size={14} /> Local SQLite Database Connected
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Database & Data Inspector</h1>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Your workspace database is fully configured. Populate realistic data to test every feature, job pipeline, invoice, and schedule route.
          </p>
        </div>

        <button
          onClick={handleSeed}
          disabled={isPending}
          className="relative z-10 bg-[#ff7a59] hover:bg-[#e86645] text-white px-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg hover:scale-105 flex items-center gap-2.5 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Sparkles size={18} />
          {isPending ? 'Seeding Database...' : '⚡ Populate Full Free Database'}
        </button>
      </div>

      {seededStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm font-semibold flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 size={20} className="text-emerald-600" />
          <span>{seededStatus} All pages now contain complete operational records.</span>
        </div>
      )}

      {/* Table Cards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {tables.map(table => (
          <div key={table.name} className="bg-white p-6 rounded-2xl border border-zinc-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="space-y-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${table.color}`}>
                <table.icon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">{table.name}</h3>
                <p className="text-2xl font-extrabold text-zinc-900 mt-1">{table.count} <span className="text-xs font-normal text-zinc-500">records</span></p>
              </div>
            </div>

            <Link 
              href={table.href} 
              className="mt-6 text-xs font-semibold text-[#6329d4] hover:text-[#5221b3] flex items-center gap-1.5 transition-colors pt-3 border-t border-zinc-100"
            >
              View Table Details <ArrowRight size={14} />
            </Link>
          </div>
        ))}
      </div>

      {/* Direct Quick Seed Information */}
      <div className="bg-white p-8 rounded-3xl border border-zinc-200/60 shadow-sm space-y-4">
        <h2 className="text-xl font-bold text-zinc-900">Database Schema & Structure</h2>
        <p className="text-sm text-zinc-600 leading-relaxed max-w-3xl">
          The database uses Prisma ORM with SQLite stored locally at <code className="bg-zinc-100 px-2 py-1 rounded text-xs font-mono">prisma/dev.db</code>. It stores 8 core relational models: <strong className="text-zinc-900">User, Business, Customer, Job, Invoice, Quote, Service, and Communication</strong>.
        </p>
        
        <div className="pt-2 flex flex-wrap gap-4">
          <button
            onClick={handleSeed}
            disabled={isPending}
            className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm flex items-center gap-2"
          >
            <Sparkles size={14} /> Re-Sync & Seed All Records
          </button>
        </div>
      </div>
    </div>
  );
}
