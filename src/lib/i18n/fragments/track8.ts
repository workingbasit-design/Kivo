/**
 * Track 8 — safe automation (recurring cron, workflow engine) + automation log.
 * `as const` fragment; registered in ../fragments.ts.
 * Also carries the notification title/body templates for the workflow
 * engine's in-app notification types.
 */
export default {
  en: {
    track8: {
      rateLimited: 'Too many requests. Please try again in a moment.',
      ruleNotFound: 'Automation rule not found.',
      automationsTitle: 'Automations',
      automationsSubtitle:
        'Safe, scheduled helpers. They can only create in-app notifications and drafts — they never send messages or move money on their own.',
      safetyNote:
        'Safety: automations only create in-app notifications and drafts. External messages still go through the opt-in messaging system only, and payments only through your own Stripe account.',
      trigger_JOB_COMPLETED: 'Job completed',
      trigger_JOB_COMPLETED_hint:
        'When a job is marked completed, create an in-app review-request draft you can copy and send yourself.',
      trigger_QUOTE_AWAITING: 'Quote awaiting response',
      trigger_QUOTE_AWAITING_hint:
        'When a sent quote sits unanswered, remind yourself to follow up with the customer.',
      trigger_INVOICE_OVERDUE: 'Invoice overdue',
      trigger_INVOICE_OVERDUE_hint:
        'When an invoice stays unpaid past its grace period, remind yourself to chase it.',
      followUpDays: 'Follow up after (days)',
      graceDays: 'Grace period (days)',
      reviewDraft: 'Create a review-request draft',
      enabled: 'On',
      disabled: 'Off',
      save: 'Save',
      saved: 'Automation settings saved.',
      runNow: 'Run now',
      runNowDone: 'Run finished: {fired} action(s) across {rules} rule(s).',
      recentActivity: 'Recent automation activity',
      noActivity: 'No automation activity yet. Runs appear here after the first scheduled run.',
      justNow: 'just now',
    },
    notifications: {
      t_review_request_draft: 'Review-request draft: {jobTitle}',
      b_review_request_draft:
        'For {customerName} — copy and send it yourself; EveryJob never sends messages on its own.\n\n“{draft}”',
      t_workflow_quote_followup: 'Quote {number} still awaiting response',
      b_workflow_quote_followup:
        '“{title}” for {customerName} (${total}) was sent a while ago. Consider following up with the customer.',
      t_workflow_invoice_overdue: 'Invoice {number} overdue',
      b_workflow_invoice_overdue:
        'Invoice {number} for {customerName} (${total}) is past its grace period. Consider chasing payment.',
    },
  },
  fr: {
    track8: {
      rateLimited: 'Trop de requêtes. Veuillez réessayer dans un moment.',
      ruleNotFound: 'Règle d’automatisation introuvable.',
      automationsTitle: 'Automatisations',
      automationsSubtitle:
        'Des assistants planifiés et sûrs. Ils ne peuvent créer que des notifications internes et des brouillons — ils n’envoient jamais de messages ni ne déplacent d’argent d’eux-mêmes.',
      safetyNote:
        'Sécurité : les automatisations ne créent que des notifications internes et des brouillons. Les messages externes passent toujours uniquement par le système de messagerie avec consentement, et les paiements uniquement par votre propre compte Stripe.',
      trigger_JOB_COMPLETED: 'Travail terminé',
      trigger_JOB_COMPLETED_hint:
        'Quand un travail est marqué terminé, crée un brouillon de demande d’avis que vous pouvez copier et envoyer vous-même.',
      trigger_QUOTE_AWAITING: 'Soumission en attente de réponse',
      trigger_QUOTE_AWAITING_hint:
        'Quand une soumission envoyée reste sans réponse, vous rappelle de faire un suivi auprès du client.',
      trigger_INVOICE_OVERDUE: 'Facture en retard',
      trigger_INVOICE_OVERDUE_hint:
        'Quand une facture reste impayée après son délai de grâce, vous rappelle de réclamer le paiement.',
      followUpDays: 'Faire un suivi après (jours)',
      graceDays: 'Délai de grâce (jours)',
      reviewDraft: 'Créer un brouillon de demande d’avis',
      enabled: 'Activé',
      disabled: 'Désactivé',
      save: 'Enregistrer',
      saved: 'Réglages d’automatisation enregistrés.',
      runNow: 'Exécuter maintenant',
      runNowDone: 'Exécution terminée : {fired} action(s) sur {rules} règle(s).',
      recentActivity: 'Activité récente des automatisations',
      noActivity: 'Aucune activité pour l’instant. Les exécutions apparaîtront ici après la première exécution planifiée.',
      justNow: 'à l’instant',
    },
    notifications: {
      t_review_request_draft: 'Brouillon de demande d’avis : {jobTitle}',
      b_review_request_draft:
        'Pour {customerName} — copiez-le et envoyez-le vous-même; EveryJob n’envoie jamais de messages de lui-même.\n\n« {draft} »',
      t_workflow_quote_followup: 'Soumission {number} toujours en attente',
      b_workflow_quote_followup:
        '« {title} » pour {customerName} ({total} $) a été envoyée il y a un moment. Pensez à faire un suivi auprès du client.',
      t_workflow_invoice_overdue: 'Facture {number} en retard',
      b_workflow_invoice_overdue:
        'La facture {number} pour {customerName} ({total} $) a dépassé son délai de grâce. Pensez à réclamer le paiement.',
    },
  },
} as const;
