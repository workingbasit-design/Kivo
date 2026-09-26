import type { Dictionary } from '../en';

/**
 * i18n fragment for the reminder queue, missed-call text-back and booking
 * availability (src/app/(app)/reminders, booking slots). All keys live
 * under the top-level `reminders` namespace. Lookup: t(locale, 'reminders.title').
 */
const fragment = {
  en: {
    reminders: {
      title: 'Reminders',
      subtitle:
        'One-tap drafts for upcoming jobs and unpaid invoices. EveryJob never sends anything — you send from your own apps.',
      upcomingJobs: 'Upcoming jobs',
      upcomingJobsEmpty:
        'No jobs in the next 48 hours need a reminder. New scheduled jobs with a customer phone number will appear here.',
      invoiceFollowups: 'Invoice follow-ups',
      invoiceFollowupsEmpty:
        'No unpaid invoices right now. Unpaid or partially paid invoices will appear here.',
      prepareReminder: 'Prepare reminder',
      preparing: 'Preparing…',
      redraft: 'Re-draft',
      draftReady: 'Draft ready — send it yourself',
      neverSendsNote:
        'EveryJob never sends messages itself. Tap a button below or copy the text and send it from your own WhatsApp, SMS or email app.',
      whatsapp: 'WhatsApp',
      sms: 'SMS',
      email: 'Email',
      copy: 'Copy',
      overdue: 'Overdue',
      missedCall: 'Missed call text-back',
      missedCallNote:
        'Manual quick-draft: pick a customer to prepare a “sorry I missed your call” text. EveryJob has no phone integration and does not detect missed calls — you choose who to text.',
      pickCustomer: 'Pick a customer…',
      draftTextback: 'Draft text-back',
      emailSubjectJob: 'Reminder: your upcoming appointment',
      emailSubjectInvoice: 'Reminder: invoice pending',
      errors: {
        notFound: 'We couldn’t find that record.',
        alreadyPaid: 'This invoice is already fully paid.',
      },
      booking: {
        preferredTime: 'Preferred time',
        loadingSlots: 'Checking availability…',
        slotsError: 'Couldn’t load availability. Pick a date and try again, or request without a time.',
        dayClosed: 'Closed on this day. Please pick another date.',
        hoursNotSetNote:
          'Online time slots aren’t set up yet — send your request and we’ll confirm a time by phone.',
        someUnscheduledNote:
          'Some bookings that day don’t have a set time yet — we’ll confirm your time by phone.',
        noSlotsLeft: 'No open slots left on this day. Please pick another date.',
        slotTaken: 'Sorry — that time was just taken. Please pick another slot.',
        invalidTime: 'Please pick a valid time slot.',
        timeRequired: 'Please pick a time slot for your booking.',
        botRetry: 'Please wait a moment and try again.',
        datePast: 'That date is in the past — please pick today or a future date.',
      },
    },
  } as Dictionary,
  fr: {
    reminders: {
      title: 'Rappels',
      subtitle:
        'Brouillons en un clic pour les rendez-vous à venir et les factures impayées. EveryJob n’envoie jamais rien — vous envoyez depuis vos propres applications.',
      upcomingJobs: 'Rendez-vous à venir',
      upcomingJobsEmpty:
        'Aucun rendez-vous dans les 48 prochaines heures ne nécessite un rappel. Les nouveaux rendez-vous planifiés avec un numéro de téléphone client apparaîtront ici.',
      invoiceFollowups: 'Suivi des factures',
      invoiceFollowupsEmpty:
        'Aucune facture impayée pour le moment. Les factures impayées ou partiellement payées apparaîtront ici.',
      prepareReminder: 'Préparer le rappel',
      preparing: 'Préparation…',
      redraft: 'Refaire le brouillon',
      draftReady: 'Brouillon prêt — envoyez-le vous-même',
      neverSendsNote:
        'EveryJob n’envoie jamais de messages lui-même. Touchez un bouton ci-dessous ou copiez le texte et envoyez-le depuis votre propre application WhatsApp, SMS ou courriel.',
      whatsapp: 'WhatsApp',
      sms: 'SMS',
      email: 'Courriel',
      copy: 'Copier',
      overdue: 'En retard',
      missedCall: 'Réponse à un appel manqué',
      missedCallNote:
        'Brouillon manuel : choisissez un client pour préparer un texte « désolé d’avoir manqué votre appel ». EveryJob n’est relié à aucun téléphone et ne détecte pas les appels manqués — c’est vous qui choisissez à qui écrire.',
      pickCustomer: 'Choisir un client…',
      draftTextback: 'Préparer le texte',
      emailSubjectJob: 'Rappel : votre prochain rendez-vous',
      emailSubjectInvoice: 'Rappel : facture en attente',
      errors: {
        notFound: 'Cet enregistrement est introuvable.',
        alreadyPaid: 'Cette facture est déjà entièrement payée.',
      },
      booking: {
        preferredTime: 'Heure souhaitée',
        loadingSlots: 'Vérification des disponibilités…',
        slotsError:
          'Impossible de charger les disponibilités. Choisissez une date et réessayez, ou envoyez sans heure.',
        dayClosed: 'Fermé ce jour-là. Veuillez choisir une autre date.',
        hoursNotSetNote:
          'Les plages horaires en ligne ne sont pas encore configurées — envoyez votre demande et nous confirmerons l’heure par téléphone.',
        someUnscheduledNote:
          'Certains rendez-vous ce jour-là n’ont pas encore d’heure fixe — nous confirmerons votre heure par téléphone.',
        noSlotsLeft: 'Plus aucune plage libre ce jour-là. Veuillez choisir une autre date.',
        slotTaken: 'Désolé — cette heure vient d’être prise. Veuillez choisir une autre plage.',
        invalidTime: 'Veuillez choisir une plage horaire valide.',
        timeRequired: 'Veuillez choisir une plage horaire pour votre réservation.',
        botRetry: 'Veuillez patienter un instant et réessayer.',
        datePast: 'Cette date est passée — veuillez choisir aujourd’hui ou une date future.',
      },
    },
  } as Dictionary,
};

export default fragment;
