import type { Dictionary } from '../en';

/**
 * Page-chrome strings for pro-side pages without their own fragment:
 * reviews list header and recurring-plan new/edit headers.
 * Every key exists in both en and fr.
 */
const fragment = {
  en: {
    reviewsPage: {
      title: 'Reviews',
      subtitle: 'Track what customers say about your work.',
    },
    recurringPage: {
      newTitle: 'New recurring plan',
      newSubtitle: 'Set it once — EveryJob creates a job every week, fortnight, or month.',
      editTitle: 'Edit recurring plan',
      backLink: 'Back to recurring jobs',
    },
  },
  fr: {
    reviewsPage: {
      title: 'Avis',
      subtitle: 'Suivez ce que vos clients disent de votre travail.',
    },
    recurringPage: {
      newTitle: 'Nouveau plan récurrent',
      newSubtitle:
        'Réglez une fois — EveryJob crée un travail chaque semaine, quinzaine ou mois.',
      editTitle: 'Modifier le plan récurrent',
      backLink: 'Retour aux travaux récurrents',
    },
  },
} as const;

export default fragment;
