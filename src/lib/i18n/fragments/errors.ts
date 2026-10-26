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
    },
  },
  fr: {
    errors: {
      somethingWentWrong: 'Une erreur est survenue. Veuillez réessayer.',
      tooManyRequests: 'Trop de requêtes. Veuillez patienter un moment et réessayer.',
      notFound: 'Cet enregistrement est introuvable.',
      uploadFailed: 'Le téléversement a échoué. Veuillez réessayer.',
    },
  },
} satisfies { en: Dictionary; fr: Dictionary };

export default fragment;
