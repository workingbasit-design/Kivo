import type { Dictionary } from '../en';

/**
 * Top-level generic error strings, referenced as `errors.*` by toasts and
 * form error maps (DeleteExpenseButton, ExpenseForm). These are NOT the
 * per-feature nested `*.errors` blocks: t() falls back to the raw dotted
 * key when a top-level key is missing, so a missing key here renders
 * literally in the UI (2026-10-26 deep-test finding).
 */
const fragment = {
  en: {
    errors: {
      somethingWentWrong: 'Something went wrong. Please try again.',
      tooManyRequests: 'Too many requests. Please wait a moment and try again.',
      notFound: 'That record could not be found.',
      uploadFailed: 'Upload failed. Please try again.',
      forbidden: {
        title: 'You don’t have access to this page',
        body: 'Your role doesn’t include access to this page. If you need it, ask an owner or admin of your business to change your role.',
      },
      pageNotFound: {
        title: 'Page not found',
        body: 'This item may have been deleted, or the link is incorrect. Double-check the address or head back to your dashboard.',
      },
      backToDashboard: '← Dashboard',
      bookingNotFound: {
        title: 'Booking page not found',
        body: 'This booking link doesn’t exist or is no longer available. Double-check the link or contact the business directly.',
      },
      profileNotFound: {
        title: 'Business profile not found',
        body: 'This business isn’t listed in the EveryJob directory, or its profile is no longer available.',
      },
    },
  },
  fr: {
    errors: {
      somethingWentWrong: 'Une erreur est survenue. Veuillez réessayer.',
      tooManyRequests: 'Trop de requêtes. Veuillez patienter un moment et réessayer.',
      notFound: 'Cet enregistrement est introuvable.',
      uploadFailed: 'Le téléversement a échoué. Veuillez réessayer.',
      forbidden: {
        title: 'Accès refusé',
        body: 'Votre rôle ne comprend pas l’accès à cette page. Si vous en avez besoin, demandez à un propriétaire ou à un administrateur de votre entreprise.',
      },
      pageNotFound: {
        title: 'Page introuvable',
        body: 'Cet élément a peut-être été supprimé, ou le lien est incorrect. Vérifiez l’adresse ou retournez au tableau de bord.',
      },
      backToDashboard: '← Tableau de bord',
      bookingNotFound: {
        title: 'Page de réservation introuvable',
        body: 'Ce lien de réservation n’existe pas ou n’est plus disponible. Vérifiez le lien ou contactez l’entreprise directement.',
      },
      profileNotFound: {
        title: 'Profil d’entreprise introuvable',
        body: 'Cette entreprise n’est pas inscrite au répertoire EveryJob ou son profil n’est plus disponible.',
      },
    },
  },
} satisfies { en: Dictionary; fr: Dictionary };

export default fragment;
