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
    <div className="min-h-dvh bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 flex flex-col -m-4 -mt-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 15%, white 0, transparent 30%), radial-gradient(circle at 85% 85%, white 0, transparent 30%)',
        }}
      />
      <header className="relative p-4">
        <Link href="/directory" className="inline-flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-lg">
          <Logo size={24} />
        </Link>
      </header>

      <main className="relative flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/20 text-white rounded-full px-4 py-1.5 mb-4">
              <Search className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">For customers</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Welcome back</h1>
            <p className="text-indigo-200 text-sm mt-2 max-w-xs mx-auto">
              Log in to find pros, track your quote requests, and message businesses.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
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
          </div>

          <p className="text-xs text-indigo-200 mt-6 text-center">
            Are you a pro?{' '}
            <Link href="/login" className="font-semibold text-white hover:underline">
              Business login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
