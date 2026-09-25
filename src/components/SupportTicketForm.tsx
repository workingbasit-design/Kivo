'use client';

import { useState } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { Field, inputClass, textareaClass, primaryBtnClass } from '@/components/ui';

/** Public support ticket form. Posts to /api/support/ticket; shows a success state. */
export default function SupportTicketForm({ locale }: { locale: Locale }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [bad, setBad] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error' | 'limited'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!name.trim()) missing.push('name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) missing.push('email');
    if (!subject.trim()) missing.push('subject');
    if (!message.trim()) missing.push('message');
    setBad(missing);
    if (missing.length > 0) {
      setStatus('idle');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      if (res.status === 429) {
        setStatus('limited');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="rounded-2xl bg-lime-50 p-5" role="status">
        <p className="font-bold text-zinc-900">{t(locale, 'support.formSuccessTitle')}</p>
        <p className="mt-1 text-sm text-zinc-700">{t(locale, 'support.formSuccessMsg')}</p>
      </div>
    );
  }

  const errCls = (f: string) =>
    bad.includes(f) ? 'border-rose-400 focus:border-rose-500' : '';

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(locale, 'support.formName')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(locale, 'support.formNamePh')}
            maxLength={80}
            autoComplete="name"
            className={`${inputClass} ${errCls('name')}`}
          />
        </Field>
        <Field label={t(locale, 'support.formEmail')}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t(locale, 'support.formEmailPh')}
            maxLength={254}
            autoComplete="email"
            className={`${inputClass} ${errCls('email')}`}
          />
        </Field>
      </div>
      <Field label={t(locale, 'support.formSubject')}>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t(locale, 'support.formSubjectPh')}
          maxLength={120}
          className={`${inputClass} ${errCls('subject')}`}
        />
      </Field>
      <Field label={t(locale, 'support.formMessage')}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t(locale, 'support.formMessagePh')}
          rows={5}
          maxLength={5000}
          className={`${textareaClass} ${errCls('message')}`}
        />
      </Field>
      {bad.length > 0 && status === 'idle' && (
        <p className="text-sm text-rose-600" role="alert">
          {t(locale, 'support.formInvalid')}
        </p>
      )}
      {status === 'error' && (
        <p className="text-sm text-rose-600" role="alert">
          {t(locale, 'support.formError')}
        </p>
      )}
      {status === 'limited' && (
        <p className="text-sm text-rose-600" role="alert">
          {t(locale, 'support.formRateLimited')}
        </p>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className={primaryBtnClass}
      >
        {status === 'sending'
          ? t(locale, 'support.formSending')
          : t(locale, 'support.formSubmit')}
      </button>
    </form>
  );
}
