/**
 * Command-bar natural language: "unpaid invoices" -> /invoices?status=UNPAID,
 * "create quote" -> /quotes/new, etc. Bilingual (EN/FR), pure and tested.
 *
 * Only maps to destinations that really exist — never invents query params.
 */
import type { Locale } from './i18n/index.ts';

export interface ParsedCommand {
  /** Label shown in the palette, e.g. 'Go to unpaid invoices'. */
  labelKey: string;
  href: string;
}

interface Pattern {
  match: RegExp;
  labelKey: string;
  href: string;
}

const PATTERNS: { en: Pattern[]; fr: Pattern[] } = {
  en: [
    { match: /\b(new|create)\b.*\bquote/, labelKey: 'newQuote', href: '/quotes/new' },
    { match: /\b(new|create|book)\b.*\bjob/, labelKey: 'newJob', href: '/jobs/new' },
    { match: /\b(new|create|add)\b.*\bcustomer/, labelKey: 'newCustomer', href: '/customers/new' },
    { match: /\b(new|create)\b.*\binvoice/, labelKey: 'newInvoice', href: '/invoices/new' },
    { match: /\b(new|add)\b.*\blead/, labelKey: 'newLead', href: '/leads' },
    { match: /\b(unpaid|overdue|outstanding)\b.*\binvoice/, labelKey: 'goUnpaidInvoices', href: '/invoices?status=UNPAID' },
    { match: /\binvoice.*\b(unpaid|overdue|outstanding)\b/, labelKey: 'goUnpaidInvoices', href: '/invoices?status=UNPAID' },
    { match: /\bpaid\b.*\binvoice/, labelKey: 'goPaidInvoices', href: '/invoices?status=PAID' },
    { match: /\binvoices?\b/, labelKey: 'goInvoices', href: '/invoices' },
    { match: /\b(quote|estimate)s?\b.*\b(sent|waiting)\b/, labelKey: 'goSentQuotes', href: '/quotes?status=SENT' },
    { match: /\b(sent|waiting)\b.*\b(quote|estimate)s?\b/, labelKey: 'goSentQuotes', href: '/quotes?status=SENT' },
    { match: /\b(draft)\b.*\bquote/, labelKey: 'goDraftQuotes', href: '/quotes?status=DRAFT' },
    { match: /\bquotes?\b/, labelKey: 'goQuotes', href: '/quotes' },
    { match: /\btoday'?s?\b.*\bschedule\b|\bschedule\b.*\btoday\b/, labelKey: 'goSchedule', href: '/schedule' },
    { match: /\bschedule\b.*\bjob/, labelKey: 'newJob', href: '/jobs/new' },
    { match: /\bschedule\b/, labelKey: 'goSchedule', href: '/schedule' },
    { match: /\battention\b|\bwhat needs\b/, labelKey: 'goAttention', href: '/attention' },
    { match: /\bowner\b.*\bmode\b/, labelKey: 'goOwner', href: '/owner' },
    { match: /\bwhat-?if\b|\bscenario/, labelKey: 'goScenarios', href: '/scenarios' },
    { match: /\bvoice\b/, labelKey: 'goVoice', href: '/voice' },
    { match: /\bleads?\b/, labelKey: 'goLeads', href: '/leads' },
    { match: /\bcustomers?\b/, labelKey: 'goCustomers', href: '/customers' },
    { match: /\bjobs?\b/, labelKey: 'goJobs', href: '/jobs' },
    { match: /\bdispatch\b/, labelKey: 'goDispatch', href: '/dispatch' },
    { match: /\breports?\b/, labelKey: 'goReports', href: '/reports' },
  ],
  fr: [
    { match: /\b(créer|nouvelle?)\b.*\bsoumission/, labelKey: 'newQuote', href: '/quotes/new' },
    { match: /\b(créer|nouveau|planifier)\b.*\b(travail|job)/, labelKey: 'newJob', href: '/jobs/new' },
    { match: /\b(créer|nouveau|ajouter)\b.*\bclient/, labelKey: 'newCustomer', href: '/customers/new' },
    { match: /\b(créer|nouvelle?)\b.*\bfacture/, labelKey: 'newInvoice', href: '/invoices/new' },
    { match: /\bfactures?\b.*\b(impayées?|en retard|dues?)\b/, labelKey: 'goUnpaidInvoices', href: '/invoices?status=UNPAID' },
    { match: /\b(impayées?|en retard)\b.*\bfactures?\b/, labelKey: 'goUnpaidInvoices', href: '/invoices?status=UNPAID' },
    { match: /\bfactures?\b.*\bpayées?\b/, labelKey: 'goPaidInvoices', href: '/invoices?status=PAID' },
    { match: /\bfactures?\b/, labelKey: 'goInvoices', href: '/invoices' },
    { match: /\bsoumissions?\b.*\benvoyées?\b/, labelKey: 'goSentQuotes', href: '/quotes?status=SENT' },
    { match: /\bsoumissions?\b.*\bbrouillon/, labelKey: 'goDraftQuotes', href: '/quotes?status=DRAFT' },
    { match: /\bsoumissions?\b/, labelKey: 'goQuotes', href: '/quotes' },
    { match: /\bhoraire\b|\bcalendrier\b/, labelKey: 'goSchedule', href: '/schedule' },
    { match: /\bà surveiller\b|\bsurveiller\b/, labelKey: 'goAttention', href: '/attention' },
    { match: /\bmode\b.*\bpropriétaire/, labelKey: 'goOwner', href: '/owner' },
    { match: /\bet si\b|\bscénario/, labelKey: 'goScenarios', href: '/scenarios' },
    { match: /\bvocal\b|\bvoix\b/, labelKey: 'goVoice', href: '/voice' },
    { match: /\bprospects?\b/, labelKey: 'goLeads', href: '/leads' },
    { match: /\bclients?\b/, labelKey: 'goCustomers', href: '/customers' },
    { match: /\btravaux\b/, labelKey: 'goJobs', href: '/jobs' },
  ],
};

const LABELS: Record<Locale, Record<string, string>> = {
  en: {
    goUnpaidInvoices: 'Unpaid invoices',
    goPaidInvoices: 'Paid invoices',
    goInvoices: 'Invoices',
    goSentQuotes: 'Sent quotes',
    goDraftQuotes: 'Draft quotes',
    goQuotes: 'Quotes',
    newQuote: 'New quote',
    newJob: 'New job',
    newCustomer: 'New customer',
    newInvoice: 'New invoice',
    newLead: 'Leads',
    goSchedule: "Today's schedule",
    goAttention: 'Needs your attention',
    goOwner: 'Owner mode',
    goScenarios: 'What-if scenarios',
    goVoice: 'Voice mode',
    goLeads: 'Leads',
    goCustomers: 'Customers',
    goJobs: 'Jobs',
    goDispatch: 'Dispatch',
    goReports: 'Reports',
  },
  fr: {
    goUnpaidInvoices: 'Factures impayées',
    goPaidInvoices: 'Factures payées',
    goInvoices: 'Factures',
    goSentQuotes: 'Soumissions envoyées',
    goDraftQuotes: 'Brouillons de soumission',
    goQuotes: 'Soumissions',
    newQuote: 'Nouvelle soumission',
    newJob: 'Nouveau travail',
    newCustomer: 'Nouveau client',
    newInvoice: 'Nouvelle facture',
    newLead: 'Prospects',
    goSchedule: 'Horaire du jour',
    goAttention: 'À surveiller',
    goOwner: 'Mode propriétaire',
    goScenarios: 'Scénarios « et si »',
    goVoice: 'Mode vocal',
    goLeads: 'Prospects',
    goCustomers: 'Clients',
    goJobs: 'Travaux',
    goDispatch: 'Répartition',
    goReports: 'Rapports',
  },
};

/** First matching NL pattern wins (patterns are ordered specific -> general). */
export function parseCommand(query: string, locale: Locale): ParsedCommand | null {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return null;
  for (const p of PATTERNS[locale]) {
    if (p.match.test(q)) {
      return { labelKey: p.labelKey, href: p.href };
    }
  }
  return null;
}

export function commandLabel(cmd: ParsedCommand, locale: Locale): string {
  return LABELS[locale][cmd.labelKey] ?? cmd.labelKey;
}
