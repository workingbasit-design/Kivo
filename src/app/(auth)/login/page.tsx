"use client";

import React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { login } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, {});

  return (
    <div className="bg-white rounded-3xl border border-zinc-200/70 shadow-xl shadow-zinc-200/50 p-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Welcome back</h1>
      <p className="text-sm text-zinc-500 mt-1 mb-6">
        Log in to run your field service business.
      </p>

      <form action={formAction} className="space-y-4">
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
            placeholder="you@yourbusiness.in"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#6329d4]/30 focus:border-[#6329d4]"
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
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#6329d4]/30 focus:border-[#6329d4]"
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
          className="w-full bg-[#6329d4] hover:bg-[#5221b3] disabled:opacity-60 text-white font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <LogIn size={16} />
          {isPending ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-500 mt-6">
        New to Kivo?{' '}
        <Link href="/register" className="font-semibold text-[#6329d4] hover:underline">
          Create your free workspace
        </Link>
      </p>
    </div>
  );
}
