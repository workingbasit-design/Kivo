/**
 * Part A (dashboard rebuild): every count message is plural-aware in
 * English and French (Intl.PluralRules via tp()). French treats 0 and 1
 * as singular. "1 jobs" must be impossible.
 *
 * Each entry renders its message with counts 0, 1 and 2 in both locales
 * and asserts the exact expected string.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tp } from '../i18n/plural.ts';
import type { Locale } from '../i18n/index.ts';

interface Case {
  path: string;
  /** extra template vars besides {count} */
  vars?: Record<string, string | number>;
  /** which var drives the plural choice (defaults to 'count') */
  countVar?: string;
  en: [string, string, string]; // expected for 0, 1, 2
  fr: [string, string, string];
}

const CASES: Case[] = [
  {
    path: 'nav.jobsLeft',
    en: ['0 jobs left', '1 job left', '2 jobs left'],
    fr: ['0 rendez-vous restant', '1 rendez-vous restant', '2 rendez-vous restants'],
  },
  {
    path: 'dashboard.unpaidInvoices',
    en: ['0 unpaid invoices', '1 unpaid invoice', '2 unpaid invoices'],
    fr: ['0 facture impayée', '1 facture impayée', '2 factures impayées'],
  },
  {
    path: 'dashboard.readyToInvoiceCount',
    en: ['0 jobs ready to bill', '1 job ready to bill', '2 jobs ready to bill'],
    fr: [
      '0 travail prêt à facturer',
      '1 travail prêt à facturer',
      '2 travaux prêts à facturer',
    ],
  },
  {
    path: 'attention.subtitle',
    en: [
      'The 0 things that matter most right now.',
      'The 1 thing that matters most right now.',
      'The 2 things that matter most right now.',
    ],
    fr: [
      'La 0 chose qui compte le plus en ce moment.',
      'La 1 chose qui compte le plus en ce moment.',
      'Les 2 choses qui comptent le plus en ce moment.',
    ],
  },
  {
    path: 'attention.items.overdueInvoice.detail',
    vars: { amount: '10.00' },
    countVar: 'days',
    en: ['0 days overdue', '1 day overdue', '2 days overdue'],
    fr: ['0 jour de retard', '1 jour de retard', '2 jours de retard'],
  },
  {
    path: 'attention.items.quoteFollowUp.detail',
    vars: { amount: '10.00' },
    countVar: 'days',
    en: [
      'No response in 0 days',
      'No response in 1 day',
      'No response in 2 days',
    ],
    fr: [
      'Sans réponse depuis 0 jour',
      'Sans réponse depuis 1 jour',
      'Sans réponse depuis 2 jours',
    ],
  },
  {
    path: 'attention.items.paidThisWeek.title',
    en: [
      '0 invoices paid this week',
      '1 invoice paid this week',
      '2 invoices paid this week',
    ],
    fr: [
      '0 facture payée cette semaine',
      '1 facture payée cette semaine',
      '2 factures payées cette semaine',
    ],
  },
];

for (const c of CASES) {
  for (const locale of ['en', 'fr'] as Locale[]) {
    test(`${c.path} [${locale}] renders 0, 1, 2 correctly`, () => {
      const expected = locale === 'en' ? c.en : c.fr;
      for (const n of [0, 1, 2]) {
        const vars = { ...(c.vars ?? {}) };
        if (c.countVar) vars[c.countVar] = n;
        assert.equal(tp(locale, c.path, n, vars), expected[n], `count=${n}`);
      }
    });
  }
}

test('"1 jobs" is impossible: no singular count renders a plural noun', () => {
  // Every message rendered with count=1 must not contain a plural noun
  // directly after the "1".
  const pluralAfterOne = /\b1 (jobs|invoices|days|factures|jours|travaux|choses)\b/;
  for (const c of CASES) {
    for (const locale of ['en', 'fr'] as Locale[]) {
      const vars = { ...(c.vars ?? {}) };
      if (c.countVar) vars[c.countVar] = 1;
      const out = tp(locale, c.path, 1, vars);
      assert.ok(
        !pluralAfterOne.test(out),
        `${c.path} [${locale}] rendered plural after 1: ${JSON.stringify(out)}`
      );
    }
  }
});
