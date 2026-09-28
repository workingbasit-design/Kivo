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
    },
    nav: {
      dispatch: 'Répartition',
    },
  },
} as const;

export default fragment;
