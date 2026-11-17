import type { Dictionary } from '../en';

/**
 * Public-page SEO metadata (generateMetadata titles + descriptions).
 * One namespace per page so the French copy lives with its English twin.
 */
const fragment = {
  en: {
    meta: {
      homeTitle: 'Find trusted local pros | EveryJob',
      homeDesc:
        'Find trusted local home-service professionals in Canada. Get free quotes, no commission, and contact them directly.',
      directoryTitle: 'Find trusted local pros | EveryJob Directory',
      directoryDesc:
        'Search the EveryJob directory for plumbers, electricians, cleaners, furnace repair and more near you. Free quotes, verified phone numbers, real reviews.',
      requestTitle: 'Request free quotes | EveryJob Directory',
      requestDesc:
        'Tell us what you need and your city - up to 5 matching local pros get your request. Free, no commission.',
      faqTitle: 'Frequently asked questions | EveryJob',
      faqDesc: 'Straight answers. No fine print, no sales pitch.',
      howTitle: 'How It Works | EveryJob',
      howDesc: 'Find a pro, get a quote, get it done. How EveryJob works for homeowners.',
    },
  } as Dictionary,
  fr: {
    meta: {
      homeTitle: 'Trouvez un pro local de confiance | EveryJob',
      homeDesc:
        'Trouvez des professionnels locaux de confiance au Canada. Obtenez des devis gratuits, sans commission, et contactez-les directement.',
      directoryTitle: 'Trouvez un pro local de confiance | Répertoire EveryJob',
      directoryDesc:
        'Recherchez dans le répertoire EveryJob plombiers, électriciens, ménage, réparation de fournaise et plus près de chez vous. Devis gratuits, numéros vérifiés, vrais avis.',
      requestTitle: 'Demander des devis gratuits | Répertoire EveryJob',
      requestDesc:
        'Dites-nous ce dont vous avez besoin et votre ville - jusqu’à 5 pros locaux correspondants reçoivent votre demande. Gratuit, sans commission.',
      faqTitle: 'Questions fréquentes | EveryJob',
      faqDesc: 'Des réponses franches. Sans petits caractères ni discours de vente.',
      howTitle: 'Comment ça marche | EveryJob',
      howDesc:
        'Trouvez un pro, obtenez un devis, et c’est fait. Comment EveryJob fonctionne pour les propriétaires.',
    },
  } as Dictionary,
};

export default fragment;
