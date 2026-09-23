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
        quoteFor: 'Quote for',
        issued: 'Issued',
        total: 'Total',
        approved: 'You approved this quote.',
        approvedNote: 'The business will be in touch to schedule the work.',
        declined: 'You declined this quote.',
        declinedNote: 'No problem — contact the business if you change your mind.',
        notReady: "This quote isn't ready yet.",
        notReadyNote: 'Please check back once the business sends it.',
        whatsappCta: 'Questions? Chat on WhatsApp',
        whatsappPrefill: 'Hi {business}! I have a question about quote {number}.',
        waitLabel: 'Please wait…',
        approveLabel: 'Approve quote',
        declineLabel: 'Decline',
        responseNote: 'Your response is sent to the business immediately.',
        errorLabel: 'Something went wrong. Please try again.',
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
        quoteFor: 'Devis pour',
        issued: 'Émis le',
        total: 'Total',
        approved: 'Vous avez approuvé ce devis.',
        approvedNote: 'L’entreprise vous contactera pour planifier les travaux.',
        declined: 'Vous avez refusé ce devis.',
        declinedNote: 'Aucun problème — contactez l’entreprise si vous changez d’avis.',
        notReady: 'Ce devis n’est pas encore prêt.',
        notReadyNote: 'Veuillez revenir une fois que l’entreprise l’aura envoyé.',
        whatsappCta: 'Des questions? Discutez sur WhatsApp',
        whatsappPrefill: 'Bonjour {business}! J’ai une question au sujet du devis {number}.',
        waitLabel: 'Veuillez patienter…',
        approveLabel: 'Approuver le devis',
        declineLabel: 'Refuser',
        responseNote: 'Votre réponse est envoyée à l’entreprise immédiatement.',
        errorLabel: 'Une erreur est survenue. Veuillez réessayer.',
      },
      route: {
        openFullRoute: "Ouvrir l'itinéraire complet dans Google Maps",
      },
    },
  } as Dictionary,
};

export default fragment;
