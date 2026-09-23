"use client";

import React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { BadgeCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { register } from '@/app/actions/auth';
import GoogleAuthSection from '@/components/GoogleAuthSection';

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(register, {});

  return (
    <div className="bg-white rounded-3xl border border-zinc-200/70 shadow-xl shadow-zinc-200/50 p-8">
      <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full mb-4">
        <BadgeCheck size={12} /> FREE FOREVER PLAN
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Set up your business</h1>
      <p className="text-sm text-zinc-500 mt-1 mb-6">
        Takes 60 seconds. No credit card, no commission.
      </p>

      <GoogleAuthSection />

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-xs font-semibold text-zinc-700 mb-1.5">
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Sarah Miller"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink"
          />
        </div>

        <div>
          <label htmlFor="businessName" className="block text-xs font-semibold text-zinc-700 mb-1.5">
            Business name
          </label>
          <input
            id="businessName"
            name="businessName"
            type="text"
            required
            autoComplete="organization"
            placeholder="Maple Leaf Plumbing"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-zinc-700 mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@yourbusiness.ca"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-zinc-700 mb-1.5">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Min. 8 characters, with a letter & number"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink"
          />
        </div>

        {state?.error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-ink hover:bg-graphite disabled:opacity-60 text-white font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={16} />
          {isPending ? 'Creating workspace…' : 'Create free workspace'}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-ink hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
