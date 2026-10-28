/**
 * Dispatch board strings (EN + FR).
 * Registered by the parent in `src/lib/i18n/fragments.ts`.
 */
const fragment = {
  en: {
    dispatch: {
      title: 'Dispatch',
      emptyTitle: 'No jobs today',
      emptyDesc: 'Nothing scheduled for this day. Add a job to get the day moving.',
      newJob: 'New job',
      emptyColumn: 'No jobs here',
      startJob: 'Start job',
      completeJob: 'Complete',
      assignTech: 'Assign technician',
      unassigned: 'Unassigned',
      noTeam: 'No team yet',
      viewDetails: 'View job details',
      callCustomer: 'Call customer',
      selectDate: 'Select date',
      routeTitle: 'Route order',
      routeHint: 'Suggested visit order for the day, nearest first. Display only — it never changes job times or assignments.',
      routeFromShop: 'from shop',
      routeFromPrev: 'from previous stop',
      routeUnorderedTitle: 'No location',
      routeUnorderedHint: 'Add an address to the job to include it in route order.',
    },
    nav: {
      dispatch: 'Dispatch',
    },
  },
  fr: {
    dispatch: {
      title: 'Répartition',
      emptyTitle: 'Aucun travail aujourd’hui',
      emptyDesc: 'Rien de planifié pour ce jour. Ajoutez un travail pour démarrer la journée.',
      newJob: 'Nouveau travail',
      emptyColumn: 'Aucun travail ici',
      startJob: 'Démarrer',
      completeJob: 'Terminer',
      assignTech: 'Assigner un technicien',
      unassigned: 'Non assigné',
      noTeam: 'Pas encore d’équipe',
      viewDetails: 'Voir les détails',
      callCustomer: 'Appeler le client',
      selectDate: 'Choisir une date',
      routeTitle: 'Ordre de tournée',
      routeHint: 'Ordre de visite suggéré pour la journée, du plus proche au plus loin. Affichage seulement — il ne change jamais les heures ni les assignations.',
      routeFromShop: 'depuis l’atelier',
      routeFromPrev: 'depuis l’arrêt précédent',
      routeUnorderedTitle: 'Sans emplacement',
      routeUnorderedHint: 'Ajoutez une adresse au travail pour l’inclure dans l’ordre de tournée.',
    },
    nav: {
      dispatch: 'Répartition',
    },
  },
} as const;

export default fragment;
