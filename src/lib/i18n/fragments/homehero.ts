import type { Dictionary } from '../en';

/**
 * Homepage hero fragment (editorial redesign): honest, stat-free copy under
 * the `homehero` namespace. Every key exists in both en and fr.
 */
const fragment = {
  en: {
    homehero: {
      eyebrow: 'Free forever · No credit card · Made for Canada',
      title1: "The job's in the texts.",
      title2: "The invoice's in email.",
      title3: "The schedule's in your head.",
      subtitle:
        "Work is scattered across texts, inboxes and memory — and for a small service business, that sprawl costs real time. EveryJob pulls it into one place: jobs, schedule, customers, quotes, invoices and an AI assistant that speaks your language.",
      // Scattered-context visual
      pillInvoice: "Where's that invoice?",
      chipMessage: 'New client text',
      chipCalendar: 'Friday 4 PM?',
      chipQuote: 'Quote draft',
      onePlace: 'One place',
      visualLabel:
        'Illustration: work scattered across texts, email and memory converging into EveryJob.',
    },
  } as Dictionary,
  fr: {
    homehero: {
      eyebrow: 'Gratuit pour toujours · Aucune carte de crédit · Fait pour le Canada',
      title1: 'Le travail est dans les textos.',
      title2: 'La facture est dans les courriels.',
      title3: "L'horaire est dans votre tête.",
      subtitle:
        'Le travail est éparpillé entre les textos, les courriels et votre mémoire — et pour une petite entreprise de services, ce fouillis coûte un temps précieux. EveryJob réunit tout au même endroit : travaux, horaire, clients, soumissions, factures et un assistant IA qui parle votre langue.',
      // Scattered-context visual
      pillInvoice: 'Où est cette facture ?',
      chipMessage: "Texto d'un client",
      chipCalendar: 'Vendredi 16 h ?',
      chipQuote: 'Brouillon de soumission',
      onePlace: 'Un seul endroit',
      visualLabel:
        "Illustration : le travail éparpillé (textos, courriels, mémoire) converge vers EveryJob.",
    },
  } as Dictionary,
};

export default fragment;
