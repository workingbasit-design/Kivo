'use client';

import { useState } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { Button, Input, Textarea } from '@/components/kit';
import { HONEYPOT_FIELD, FORM_STARTED_FIELD } from '@/lib/bot-check';

/** Public support ticket form. Posts to /api/support/ticket; shows a success state. */
export default function SupportTicketForm({ locale }: { locale: Locale }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [bad, setBad] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error' | 'limited'>('idle');
  // B11.1: honeypot + fill-time carriers for the server-side bot check.
  const [honeypot, setHoneypot] = useState('');
  const [formStartedAt] = useState(() => String(Date.now()));

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
          [HONEYPOT_FIELD]: honeypot,
          [FORM_STARTED_FIELD]: formStartedAt,
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
      <div className="rounded-2xl bg-hivis-soft p-5" role="status">
        <p className="font-bold text-ink">{t(locale, 'support.formSuccessTitle')}</p>
        <p className="mt-1 text-sm text-ink">{t(locale, 'support.formSuccessMsg')}</p>
      </div>
    );
  }

  const err = (f: string) => (bad.includes(f) ? '' : undefined);

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {/* Honeypot: invisible to humans (off-screen + aria-hidden); bots that
          fill it are rejected server-side. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
      >
        <label htmlFor="support-website">Website</label>
        <input
          id="support-website"
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t(locale, 'support.formName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(locale, 'support.formNamePh')}
          maxLength={80}
          autoComplete="name"
          error={err('name')}
        />
        <Input
          label={t(locale, 'support.formEmail')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t(locale, 'support.formEmailPh')}
          maxLength={254}
          autoComplete="email"
          error={err('email')}
        />
      </div>
      <Input
        label={t(locale, 'support.formSubject')}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder={t(locale, 'support.formSubjectPh')}
        maxLength={120}
        error={err('subject')}
      />
      <Textarea
        label={t(locale, 'support.formMessage')}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t(locale, 'support.formMessagePh')}
        rows={5}
        maxLength={5000}
        error={err('message')}
      />
      {bad.length > 0 && status === 'idle' && (
        <p className="text-sm text-danger" role="alert">
          {t(locale, 'support.formInvalid')}
        </p>
      )}
      {status === 'error' && (
        <p className="text-sm text-danger" role="alert">
          {t(locale, 'support.formError')}
        </p>
      )}
      {status === 'limited' && (
        <p className="text-sm text-danger" role="alert">
          {t(locale, 'support.formRateLimited')}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        disabled={status === 'sending'}
      >
        {status === 'sending'
          ? t(locale, 'support.formSending')
          : t(locale, 'support.formSubmit')}
      </Button>
    </form>
  );
}
