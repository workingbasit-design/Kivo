import type { Dictionary } from '../en';

/**
 * Audit log viewer (P1.0 F2): who did what, when. The rows are written by
 * auditUserAction() at every money / team / settings / delete / auth
 * action and are append-only at the DB level (trigger rejects
 * UPDATE/DELETE), which is what makes them a usable record for the
 * 6-year CRA retention duty.
 */
const fragment = {
  en: {
    auditLog: {
      pageTitle: 'Audit log',
      pageSubtitle:
        'Who did what, when. Money, team and settings changes are recorded here and cannot be edited or deleted.',
      filterAction: 'Action',
      filterEntity: 'Record',
      filterAll: 'All',
      filterApply: 'Apply filters',
      colTime: 'When',
      colActor: 'Who',
      colAction: 'Action',
      colEntity: 'Record',
      colDetails: 'Details',
      empty: 'No activity yet.',
      systemActor: 'System',
      unknownActor: 'Unknown user',
      beforeLabel: 'Before',
      afterLabel: 'After',
    },
  } as Dictionary,
  fr: {
    auditLog: {
      pageTitle: 'Journal d’audit',
      pageSubtitle:
        'Qui a fait quoi, et quand. Les modifications d’argent, d’équipe et de paramètres sont consignées ici et ne peuvent être ni modifiées ni supprimées.',
      filterAction: 'Action',
      filterEntity: 'Enregistrement',
      filterAll: 'Tout',
      filterApply: 'Appliquer les filtres',
      colTime: 'Quand',
      colActor: 'Qui',
      colAction: 'Action',
      colEntity: 'Enregistrement',
      colDetails: 'Détails',
      empty: 'Aucune activité pour le moment.',
      systemActor: 'Système',
      unknownActor: 'Utilisateur inconnu',
      beforeLabel: 'Avant',
      afterLabel: 'Après',
    },
  } as Dictionary,
};

export default fragment;
