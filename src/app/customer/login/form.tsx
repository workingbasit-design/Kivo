"use client";

import Link from 'next/link';
import { useActionState } from 'react';
import { LogIn, AlertCircle, Search } from 'lucide-react';
import { customerLogin } from '@/app/actions/customer-auth';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import Logo from '@/components/Logo';

export default function CustomerLoginForm() {
  const [state, formAction, isPending] = useActionState(customerLogin, { error: '' });

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white flex flex-col -m-4 -mt-4">
      <header className="p-4">
        <Link href="/directory" className="inline-flex items-center gap-2">
          <Logo />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-sm bg-white rounded-3xl border border-zinc-200/70 shadow-xl shadow-zinc-200/50 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Search className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">For customers</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Welcome back</h1>
          <p className="text-sm text-zinc-500 mt-1 mb-6">
            Log in to find pros, track your quote requests, and message businesses.
          </p>

          <form action={formAction} className="space-y-4">
            <Field label="Email">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
              />
            </Field>

            <Field label="Password">
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Your password"
                className={inputClass}
              />
            </Field>

            {state?.error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {state.error}
              </div>
            )}

            <button type="submit" disabled={isPending} className={primaryBtnClass}>
              <LogIn className="w-4 h-4" />
              {isPending ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p className="text-sm text-zinc-500 mt-6 text-center">
            New here?{' '}
            <Link href="/customer/signup" className="font-semibold text-indigo-600 hover:underline">
              Create a free account
            </Link>
          </p>

          <p className="text-xs text-zinc-400 mt-4 text-center">
            Are you a pro?{' '}
            <Link href="/login" className="font-medium hover:underline">
              Business login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
