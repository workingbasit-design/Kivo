import type { Dictionary } from '../en';

/**
 * Quotes fragment: quote add-ons (owner + client portal), full-route Maps
 * link. All keys live under the `quotes` namespace.
 */
const fragment = {
  en: {
    quotes: {
      addons: {
        title: 'Optional add-ons',
        hint: 'Extras the client can choose when approving this quote.',
        add: 'Add add-on',
        nameLabel: 'Add-on name',
        priceLabel: 'Price (CAD)',
        edit: 'Edit',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        deleteConfirm: 'Delete this add-on?',
        empty:
          'No add-ons yet — add extras like rush service or an extended warranty.',
        locked: 'Add-ons are locked once a quote is approved.',
        errorInvalid: 'Enter a name and a price of 0 or more.',
      },
      portal: {
        baseTotal: 'Quote total',
        addonsTitle: 'Optional add-ons',
        addonsHint:
          'Tick any extras to include — your total updates instantly.',
        yourTotal: 'Your total',
        includedAddons: 'Included add-ons',
      },
      route: {
        openFullRoute: 'Open full route in Google Maps',
      },
    },
  } as Dictionary,
  fr: {
    quotes: {
      addons: {
        title: 'Options supplémentaires',
        hint: 'Extras que le client peut choisir en approuvant ce devis.',
        add: 'Ajouter une option',
        nameLabel: "Nom de l'option",
        priceLabel: 'Prix (CAD)',
        edit: 'Modifier',
        save: 'Enregistrer',
        cancel: 'Annuler',
        delete: 'Supprimer',
        deleteConfirm: 'Supprimer cette option?',
        empty:
          'Aucune option pour le moment — ajoutez des extras comme un service express ou une garantie prolongée.',
        locked: 'Les options sont verrouillées une fois le devis approuvé.',
        errorInvalid: 'Entrez un nom et un prix de 0 ou plus.',
      },
      portal: {
        baseTotal: 'Total du devis',
        addonsTitle: 'Options supplémentaires',
        addonsHint:
          'Cochez les extras à inclure — votre total se met à jour instantanément.',
        yourTotal: 'Votre total',
        includedAddons: 'Options incluses',
      },
      route: {
        openFullRoute: "Ouvrir l'itinéraire complet dans Google Maps",
      },
    },
  } as Dictionary,
};

export default fragment;
