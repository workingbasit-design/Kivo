import type { Dictionary } from '../en';

/**
 * F10 global search strings (EN + FR).
 * Registered by the parent in `src/lib/i18n/fragments.ts`.
 */
const fragment = {
  en: {
    search: {
      placeholder: 'Search customers, jobs, quotes, invoices…',
      hint: 'Type at least 2 characters to search your records.',
      searching: 'Searching…',
      noResults: 'No matches found.',
      noResultsHint: 'Try a name, phone number, or document number.',
      groupCustomers: 'Customers',
      groupJobs: 'Jobs',
      groupQuotes: 'Quotes',
      groupInvoices: 'Invoices',
      viewAll: 'View all results',
    },
    notifBell: {
      viewAll: 'View all notifications',
      empty: 'No recent notifications.',
      markAllRead: 'Mark all as read',
    },
  } as Dictionary,
  fr: {
    search: {
      placeholder: 'Rechercher clients, travaux, soumissions, factures…',
      hint: 'Tapez au moins 2 caractères pour chercher dans vos dossiers.',
      searching: 'Recherche…',
      noResults: 'Aucun résultat.',
      noResultsHint: 'Essayez un nom, un numéro de téléphone ou un numéro de document.',
      groupCustomers: 'Clients',
      groupJobs: 'Travaux',
      groupQuotes: 'Soumissions',
      groupInvoices: 'Factures',
      viewAll: 'Voir tous les résultats',
    },
    notifBell: {
      viewAll: 'Voir toutes les notifications',
      empty: 'Aucune notification récente.',
      markAllRead: 'Tout marquer comme lu',
    },
  } as Dictionary,
};

export default fragment;
