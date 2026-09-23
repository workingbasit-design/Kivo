import type { Dictionary } from '../en';

/**
 * Homepage FAQ fragment: answers the questions real Canadian home-service
 * owners actually ask (from search/community research). Every claim is
 * honest: free plan, Canada-only, CAD, preview-only Copilot, no automatic
 * customer messaging, payments recorded not processed.
 * Every key exists in both en and fr.
 */
const fragment = {
  en: {
    homefaq: {
      eyebrow: 'Questions, answered',
      title: 'What owners ask before switching',
      subtitle:
        'Straight answers — no fine print, no sales pitch.',
      q1: 'Is EveryJob really free?',
      a1: 'Yes. EveryJob is free for Canadian home-service businesses: jobs, scheduling, customers, quotes, invoices and the AI assistant are included. No credit card required.',
      q2: 'What is field-service software?',
      a2: 'Field-service software helps businesses that work at customer locations — plumbers, HVAC technicians, electricians, cleaners and others — manage jobs, schedules, quotes and invoices in one place, instead of juggling texts, spreadsheets and memory.',
      q3: 'Who is EveryJob built for?',
      a3: 'Independent pros and small teams of 1 to 5 people across Canada: plumbing, heating and cooling, electrical, cleaning, landscaping, painting, pest control, appliance repair, handyman work and more.',
      q4: 'Does EveryJob work in French?',
      a4: 'Yes. EveryJob is fully bilingual in English and Canadian French — the app, the website and the AI assistant all speak both languages.',
      q5: 'Will EveryJob message my customers on its own?',
      a5: 'Never. EveryJob drafts reminders, quotes and follow-ups for you to review, but nothing is ever sent to a customer until you explicitly confirm and send it yourself.',
      q6: 'Does EveryJob process payments or hold my money?',
      a6: 'No. You record payments in EveryJob — for example an Interac e-Transfer you received — but money always moves through your own bank and accounts, never through EveryJob.',
      q7: 'Which parts of Canada does EveryJob support?',
      a7: 'All of Canada. EveryJob works in Canadian dollars (CAD) and supports Canadian sales taxes.',
    },
  } as Dictionary,
  fr: {
    homefaq: {
      eyebrow: 'Vos questions, nos réponses',
      title: 'Ce que les propriétaires demandent avant de changer',
      subtitle:
        'Des réponses franches — sans petits caractères ni discours de vente.',
      q1: 'Est-ce qu’EveryJob est vraiment gratuit ?',
      a1: 'Oui. EveryJob est gratuit pour les entreprises canadiennes de services à domicile : travaux, horaire, clients, soumissions, factures et assistant IA sont inclus. Aucune carte de crédit requise.',
      q2: 'Qu’est-ce qu’un logiciel de gestion d’interventions ?',
      a2: 'Un logiciel de gestion d’interventions aide les entreprises qui travaillent chez leurs clients — plombiers, techniciens en chauffage et climatisation, électriciens, services de nettoyage et autres — à gérer leurs travaux, leur horaire, leurs soumissions et leurs factures au même endroit, plutôt que de jongler entre textos, chiffriers et mémoire.',
      q3: 'Pour qui EveryJob est-il conçu ?',
      a3: 'Pour les travailleurs autonomes et les petites équipes de 1 à 5 personnes partout au Canada : plomberie, chauffage et climatisation, électricité, nettoyage, aménagement paysager, peinture, extermination, réparation d’appareils, travaux divers et plus encore.',
      q4: 'Est-ce qu’EveryJob fonctionne en français ?',
      a4: 'Oui. EveryJob est entièrement bilingue en anglais et en français canadien — l’application, le site Web et l’assistant IA parlent les deux langues.',
      q5: 'Est-ce qu’EveryJob envoie des messages à mes clients de lui-même ?',
      a5: 'Jamais. EveryJob prépare des rappels, des soumissions et des suivis que vous révisez, mais rien n’est jamais envoyé à un client avant que vous l’ayez explicitement confirmé et envoyé vous-même.',
      q6: 'Est-ce qu’EveryJob traite des paiements ou détient mon argent ?',
      a6: 'Non. Vous enregistrez les paiements dans EveryJob — par exemple un Virement Interac reçu — mais l’argent transite toujours par votre propre banque et vos propres comptes, jamais par EveryJob.',
      q7: 'Quelles régions du Canada EveryJob prend-il en charge ?',
      a7: 'Tout le Canada. EveryJob fonctionne en dollars canadiens (CAD) et prend en charge les taxes de vente canadiennes.',
    },
  } as Dictionary,
};

export default fragment;
