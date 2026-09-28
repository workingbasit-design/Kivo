/**
 * Leads page strings (EN + FR).
 * Registered by the parent in `src/lib/i18n/fragments.ts`.
 */
const fragment = {
  en: {
    leads: {
      title: 'Leads',
      subtitleWaiting: '{count} new lead(s) waiting for a follow-up',
      subtitleDefault: 'Track enquiries until they become customers.',
      emptyTitle: 'No leads yet',
      emptyDesc:
        'When someone enquires on WhatsApp or by phone, add them here so no enquiry slips through.',
    },
  },
  fr: {
    leads: {
      title: 'Pistes',
      subtitleWaiting: '{count} nouvelle(s) piste(s) en attente de suivi',
      subtitleDefault: 'Suivez les demandes jusqu’à ce qu’elles deviennent des clients.',
      emptyTitle: 'Aucune piste pour le moment',
      emptyDesc:
        'Quand quelqu’un vous contacte sur WhatsApp ou par téléphone, ajoutez-le ici pour ne rien manquer.',
    },
  },
} as const;

export default fragment;
