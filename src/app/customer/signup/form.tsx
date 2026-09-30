"use client";

import Link from 'next/link';
import { useActionState } from 'react';
import { UserPlus, AlertCircle, Search } from 'lucide-react';
import { customerSignup } from '@/app/actions/customer-auth';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import Logo from '@/components/Logo';

export default function CustomerSignupForm() {
  const [state, formAction, isPending] = useActionState(customerSignup, { error: '' });

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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Find trusted pros</h1>
          <p className="text-sm text-zinc-500 mt-1 mb-6">
            One free account to search, save favourites, request quotes, and message local pros.
          </p>

          <form action={formAction} className="space-y-4">
            <Field label="Full name">
              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Jane Doe"
                className={inputClass}
              />
            </Field>

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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone (optional)">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="(416) 555-0100"
                  className={inputClass}
                />
              </Field>
              <Field label="City (optional)">
                <input
                  id="city"
                  name="city"
                  type="text"
                  autoComplete="address-level2"
                  placeholder="Toronto"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Password">
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
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
              <UserPlus className="w-4 h-4" />
              {isPending ? 'Creating account…' : 'Create free account'}
            </button>
          </form>

          <p className="text-sm text-zinc-500 mt-6 text-center">
            Already have an account?{' '}
            <Link href="/customer/login" className="font-semibold text-indigo-600 hover:underline">
              Log in
            </Link>
          </p>

          <p className="text-xs text-zinc-400 mt-4 text-center">
            Are you a pro?{' '}
            <Link href="/register" className="font-medium hover:underline">
              Join as a business
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
