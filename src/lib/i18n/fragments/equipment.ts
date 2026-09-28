/**
 * Equipment tracking strings (EN + FR).
 * Registered by the parent in `src/lib/i18n/fragments.ts`.
 */
const fragment = {
  en: {
    equipment: {
      title: 'Equipment',
      subtitle: 'Track customer equipment — HVAC units, appliances, and more.',
      add: 'Add equipment',
      searchPlaceholder: 'Search equipment…',
      emptyTitle: 'No equipment yet',
      emptyDesc: 'Add equipment to customer records so technicians know what they\u2019re servicing.',
      noResults: 'No equipment found',
      noResultsDesc: 'Try a different search term.',
      noDetails: 'No brand/model recorded',
      serial: 'S/N',
      customer: 'Customer',
      brand: 'Brand',
      model: 'Model',
      installDate: 'Install date',
      notes: 'Notes',
      name: 'Equipment name',
      namePlaceholder: 'e.g. Furnace, AC Unit, Water Heater',
      save: 'Save equipment',
      update: 'Update equipment',
      delete: 'Delete equipment',
      deleteConfirmTitle: 'Delete this equipment?',
      deleteConfirm: 'This equipment record will be permanently removed. This cannot be undone.',
      cancel: 'Cancel',
      edit: 'Edit',
      back: 'Back to equipment',
      selectCustomer: 'Select customer',
    },
    nav: {
      equipment: 'Equipment',
    },
  },
  fr: {
    equipment: {
      title: 'Équipement',
      subtitle: 'Suivez l\u2019équipement des clients — unités CVC, appareils, et plus.',
      add: 'Ajouter un équipement',
      searchPlaceholder: 'Rechercher un équipement…',
      emptyTitle: 'Aucun équipement',
      emptyDesc: 'Ajoutez de l\u2019équipement aux fiches clients pour que les techniciens sachent quoi entretenir.',
      noResults: 'Aucun équipement trouvé',
      noResultsDesc: 'Essayez un autre terme de recherche.',
      noDetails: 'Marque/modèle non enregistré',
      serial: 'N/S',
      customer: 'Client',
      brand: 'Marque',
      model: 'Modèle',
      installDate: 'Date d\u2019installation',
      notes: 'Notes',
      name: 'Nom de l\u2019équipement',
      namePlaceholder: 'p. ex. Fournaise, Climatiseur, Chauffe-eau',
      save: 'Enregistrer',
      update: 'Mettre à jour',
      delete: 'Supprimer',
      deleteConfirmTitle: 'Supprimer cet équipement?',
      deleteConfirm: 'Cet équipement sera définitivement supprimé. Cette action est irréversible.',
      cancel: 'Annuler',
      edit: 'Modifier',
      back: 'Retour à l\u2019équipement',
      selectCustomer: 'Choisir un client',
    },
    nav: {
      equipment: 'Équipement',
    },
  },
} as const;

export default fragment;
