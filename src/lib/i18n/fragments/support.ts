import type { Dictionary } from '../en';

/**
 * Support: public help center, support ticket form, onboarding checklist.
 * Every key exists in both en and fr.
 */
const fragment = {
  en: {
    support: {
      helpTitle: 'Help center',
      helpSub:
        'Real guides for the real app — searchable, in English and French.',
      searchPh: 'Search articles…',
      searchLabel: 'Search help articles',
      searchBtn: 'Search',
      categoriesLabel: 'Browse by topic',
      allLabel: 'All articles',
      noResults: 'No articles match your search.',
      noResultsHint: 'Try different words, or ask the AI assistant (bottom-right).',
      relatedTitle: 'Related articles',
      backToHelp: 'Back to help center',
      updatedNote: 'Written from the app as it works today.',
      ticketTitle: 'Still stuck? Talk to a human.',
      ticketDesc:
        'Your ticket goes directly to the owner of EveryJob — no ticket black hole, no tiered queues.',
      formName: 'Your name',
      formNamePh: 'Jane Smith',
      formEmail: 'Email',
      formEmailPh: 'you@example.ca',
      formSubject: 'Subject',
      formSubjectPh: 'What is this about?',
      formMessage: 'Message',
      formMessagePh:
        'What were you trying to do? What did you expect? What did you see instead?',
      formSubmit: 'Send ticket',
      formSending: 'Sending…',
      formSuccessTitle: 'Ticket received.',
      formSuccessMsg:
        'Thanks — a human (usually the person who built the feature) will read it and reply to your email.',
      formError: 'Something went wrong sending your ticket. Please try again.',
      formRateLimited: 'You have sent a few tickets already. Please wait a bit and try again.',
      formInvalid: 'Please check the highlighted fields and try again.',
      onboardingTitle: 'Get set up',
      onboardingSub: 'Six steps to a business-ready EveryJob.',
      onboardingProgress: 'of 6 complete',
      onboardingAllDone: 'You are all set up — nice work.',
      onboardingDismiss: 'Dismiss',
      onboardingShow: 'Show setup checklist',
      inboxTitle: 'Support inbox',
      inboxSub: 'Tickets sent from the help center. Reply by email — nothing is sent automatically.',
      inboxEmpty: 'No tickets yet.',
      inboxRestricted: 'The support inbox is only visible to the product owner. Set OWNER_EMAILS to your email to open it.',
      inboxOpen: 'Open',
      inboxAnswered: 'Answered',
      inboxClosed: 'Closed',
      inboxMarkAnswered: 'Mark answered',
      inboxMarkClosed: 'Close',
      inboxReopen: 'Reopen',
      steps: {
        logo: {
          title: 'Add your business logo',
          desc: 'Upload your logo in Settings — it appears on quotes and invoices.',
          cta: 'Upload logo',
        },
        customer: {
          title: 'Add your first customer',
          desc: 'Add one manually, or import your whole list from CSV or Excel.',
          cta: 'Add customer',
        },
        job: {
          title: 'Create your first job',
          desc: 'Create a job and move it through the pipeline: New → Paid.',
          cta: 'Create job',
        },
        quote: {
          title: 'Send your first quote or invoice',
          desc: 'Send a quote, get it approved, then turn it into an invoice.',
          cta: 'Create quote',
        },
        google: {
          title: 'Connect Google',
          desc: 'Link your Google account in Settings for easy sign-in.',
          cta: 'Connect',
        },
        team: {
          title: 'Invite your team',
          desc: 'Invite a team member in Settings → Team.',
          cta: 'Invite team',
        },
      },
    },
  },
  fr: {
    support: {
      helpTitle: 'Centre d’aide',
      helpSub:
        'De vrais guides pour la vraie application — consultables, en français et en anglais.',
      searchPh: 'Rechercher des articles…',
      searchLabel: 'Rechercher dans les articles d’aide',
      searchBtn: 'Rechercher',
      categoriesLabel: 'Parcourir par sujet',
      allLabel: 'Tous les articles',
      noResults: 'Aucun article ne correspond à votre recherche.',
      noResultsHint:
        'Essayez d’autres mots, ou demandez à l’assistant IA (en bas à droite).',
      relatedTitle: 'Articles connexes',
      backToHelp: 'Retour au centre d’aide',
      updatedNote: 'Rédigé d’après l’application telle qu’elle fonctionne aujourd’hui.',
      ticketTitle: 'Toujours bloqué? Parlez à un humain.',
      ticketDesc:
        'Votre billet va directement au propriétaire d’EveryJob — pas de trou noir, pas de files d’attente.',
      formName: 'Votre nom',
      formNamePh: 'Marie Tremblay',
      formEmail: 'Courriel',
      formEmailPh: 'vous@exemple.ca',
      formSubject: 'Objet',
      formSubjectPh: 'De quoi s’agit-il?',
      formMessage: 'Message',
      formMessagePh:
        'Qu’essayiez-vous de faire? À quoi vous attendiez-vous? Qu’avez-vous vu à la place?',
      formSubmit: 'Envoyer le billet',
      formSending: 'Envoi…',
      formSuccessTitle: 'Billet reçu.',
      formSuccessMsg:
        'Merci — un humain (généralement la personne qui a conçu la fonction) le lira et vous répondra par courriel.',
      formError: 'Un problème est survenu lors de l’envoi. Veuillez réessayer.',
      formRateLimited: 'Vous avez déjà envoyé quelques billets. Attendez un peu et réessayez.',
      formInvalid: 'Vérifiez les champs surlignés et réessayez.',
      onboardingTitle: 'Mise en route',
      onboardingSub: 'Six étapes pour un EveryJob prêt à travailler.',
      onboardingProgress: 'sur 6 terminées',
      onboardingAllDone: 'Tout est configuré — beau travail.',
      onboardingDismiss: 'Masquer',
      onboardingShow: 'Afficher la liste de démarrage',
      inboxTitle: 'Boîte de réception d’assistance',
      inboxSub: 'Billets envoyés depuis le centre d’aide. Répondez par courriel — rien n’est envoyé automatiquement.',
      inboxEmpty: 'Aucun billet pour l’instant.',
      inboxRestricted: 'La boîte de réception d’assistance n’est visible que par le propriétaire du produit. Définissez OWNER_EMAILS à votre courriel pour l’ouvrir.',
      inboxOpen: 'Ouvert',
      inboxAnswered: 'Répondu',
      inboxClosed: 'Fermé',
      inboxMarkAnswered: 'Marquer comme répondu',
      inboxMarkClosed: 'Fermer',
      inboxReopen: 'Rouvrir',
      steps: {
        logo: {
          title: 'Ajoutez le logo de votre entreprise',
          desc: 'Téléversez votre logo dans Paramètres — il apparaît sur les soumissions et factures.',
          cta: 'Téléverser le logo',
        },
        customer: {
          title: 'Ajoutez votre premier client',
          desc: 'Ajoutez-en un manuellement, ou importez toute votre liste depuis CSV ou Excel.',
          cta: 'Ajouter un client',
        },
        job: {
          title: 'Créez votre premier travail',
          desc: 'Créez un travail et faites-le avancer : Nouveau → Payé.',
          cta: 'Créer un travail',
        },
        quote: {
          title: 'Envoyez votre première soumission ou facture',
          desc: 'Envoyez une soumission, faites-la approuver, puis convertissez-la en facture.',
          cta: 'Créer une soumission',
        },
        google: {
          title: 'Connectez Google',
          desc: 'Liez votre compte Google dans Paramètres pour une connexion facile.',
          cta: 'Connecter',
        },
        team: {
          title: 'Invitez votre équipe',
          desc: 'Invitez un membre d’équipe dans Paramètres → Équipe.',
          cta: 'Inviter l’équipe',
        },
      },
    },
  },
} as const;

export default fragment;
