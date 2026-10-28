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
          'No add-ons yet. Add extras like rush service or an extended warranty.',
        locked: 'Add-ons are locked once a quote is approved.',
        errorInvalid: 'Enter a name and a price of 0 or more.',
      },
      portal: {
        baseTotal: 'Quote total',
        subtotal: 'Subtotal',
        addonsTitle: 'Optional add-ons',
        addonsHint:
          'Tick any extras to include. Your total updates instantly.',
        yourTotal: 'Your total',
        includedAddons: 'Included add-ons',
        quoteFor: 'Quote for',
        issued: 'Issued',
        total: 'Total',
        approved: 'You approved this quote.',
        approvedNote: 'The business will be in touch to schedule the work.',
        declined: 'You declined this quote.',
        declinedNote: 'No problem. Contact the business if you change your mind.',
        notReady: "This quote isn't ready yet.",
        notReadyNote: 'Please check back once the business sends it.',
        whatsappCta: 'Questions? Chat on WhatsApp',
        whatsappPrefill: 'Hi {business}! I have a question about quote {number}.',
        waitLabel: 'Please wait…',
        approveLabel: 'Approve quote',
        declineLabel: 'Decline',
        responseNote: 'Your response is sent to the business immediately.',
        errorLabel: 'Something went wrong. Please try again.',
        signerNameLabel: 'Type your full name to sign',
        signerNamePlaceholder: 'Jane Doe',
        consentLabel: 'I agree to the quote terms and confirm this electronic signature is legally binding.',
      },
      route: {
        openFullRoute: 'Open full route in Google Maps',
      },
      list: {
        title: 'Quotes',
        newQuote: 'New quote',
        subtitle: '{count} {quoteWord}, {pipeline} in open pipeline',
        quoteOne: 'quote',
        quoteOther: 'quotes',
        filterAll: 'All',
        filterDraft: 'Draft',
        filterSent: 'Sent',
        filterApproved: 'Approved',
        filterDeclined: 'Declined',
        emptyTitle: 'No quotes yet',
        emptyDesc:
          'Send your first quote in under a minute. Line items in, a clean total out.',
      },
      new: {
        title: 'New quote',
        subtitle:
          'Line items in, total out. {taxLabel} is added automatically from your region settings.',
      },
      templates: {
        title: 'Quote templates',
        subtitle:
          'Saved line packages — start a quote from one instead of retyping it.',
        newTemplate: 'New template',
        editTemplate: 'Edit template',
        nameLabel: 'Template name',
        namePlaceholder: 'e.g. Furnace tune-up package',
        saveTemplate: 'Save template',
        templateSaved: 'Template saved.',
        templateDeleted: 'Template deleted.',
        deleteTemplate: 'Delete template',
        deleteConfirm:
          'Delete this template? Quotes already built from it are unaffected.',
        emptyTitle: 'No templates yet',
        emptyDesc:
          'Save a template once, then start any quote from it in seconds.',
        useTemplate: 'Start from template…',
        blankOption: 'Blank quote',
        saveAsTemplate: 'Save as template',
        lineOne: '1 line',
        lineOther: '{count} lines',
        fromQuoteHint:
          'Starting from quote {title} — edit the lines, then save as a new template.',
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
          'Aucune option pour le moment. Ajoutez des extras comme un service express ou une garantie prolongée.',
        locked: 'Les options sont verrouillées une fois le devis approuvé.',
        errorInvalid: 'Entrez un nom et un prix de 0 ou plus.',
      },
      portal: {
        baseTotal: 'Total du devis',
        subtotal: 'Sous-total',
        addonsTitle: 'Options supplémentaires',
        addonsHint:
          'Cochez les extras à inclure. Votre total se met à jour instantanément.',
        yourTotal: 'Votre total',
        includedAddons: 'Options incluses',
        quoteFor: 'Devis pour',
        issued: 'Émis le',
        total: 'Total',
        approved: 'Vous avez approuvé ce devis.',
        approvedNote: 'L’entreprise vous contactera pour planifier les travaux.',
        declined: 'Vous avez refusé ce devis.',
        declinedNote: 'Aucun problème. Contactez l’entreprise si vous changez d’avis.',
        notReady: 'Ce devis n’est pas encore prêt.',
        notReadyNote: 'Veuillez revenir une fois que l’entreprise l’aura envoyé.',
        whatsappCta: 'Des questions? Discutez sur WhatsApp',
        whatsappPrefill: 'Bonjour {business}! J’ai une question au sujet du devis {number}.',
        waitLabel: 'Veuillez patienter…',
        approveLabel: 'Approuver le devis',
        declineLabel: 'Refuser',
        responseNote: 'Votre réponse est envoyée à l’entreprise immédiatement.',
        errorLabel: 'Une erreur est survenue. Veuillez réessayer.',
        signerNameLabel: 'Tapez votre nom complet pour signer',
        signerNamePlaceholder: 'Jean Dupont',
        consentLabel: 'J’accepte les conditions du devis et je confirme que cette signature électronique a valeur légale.',
      },
      route: {
        openFullRoute: "Ouvrir l'itinéraire complet dans Google Maps",
      },
      list: {
        title: 'Devis',
        newQuote: 'Nouveau devis',
        subtitle: '{count} {quoteWord}, {pipeline} en pipeline ouvert',
        quoteOne: 'devis',
        quoteOther: 'devis',
        filterAll: 'Tous',
        filterDraft: 'Brouillon',
        filterSent: 'Envoyé',
        filterApproved: 'Approuvé',
        filterDeclined: 'Refusé',
        emptyTitle: 'Aucun devis pour le moment',
        emptyDesc:
          'Envoyez votre premier devis en moins d\u2019une minute. Articles entrés, total clair en sortie.',
      },
      new: {
        title: 'Nouveau devis',
        subtitle:
          'Articles entrés, total en sortie. {taxLabel} est ajouté automatiquement selon vos paramètres régionaux.',
      },
      templates: {
        title: 'Modèles de devis',
        subtitle:
          'Ensembles de lignes enregistrés — commencez un devis à partir d’un modèle au lieu de tout retaper.',
        newTemplate: 'Nouveau modèle',
        editTemplate: 'Modifier le modèle',
        nameLabel: 'Nom du modèle',
        namePlaceholder: 'p. ex. Forfait de mise au point de fournaise',
        saveTemplate: 'Enregistrer le modèle',
        templateSaved: 'Modèle enregistré.',
        templateDeleted: 'Modèle supprimé.',
        deleteTemplate: 'Supprimer le modèle',
        deleteConfirm:
          'Supprimer ce modèle? Les devis déjà créés à partir de celui-ci ne seront pas touchés.',
        emptyTitle: 'Aucun modèle pour le moment',
        emptyDesc:
          'Enregistrez un modèle une fois, puis commencez n’importe quel devis à partir de celui-ci en quelques secondes.',
        useTemplate: 'Commencer à partir d’un modèle…',
        blankOption: 'Devis vierge',
        saveAsTemplate: 'Enregistrer comme modèle',
        lineOne: '1 ligne',
        lineOther: '{count} lignes',
        fromQuoteHint:
          'À partir du devis {title} — modifiez les lignes, puis enregistrez comme nouveau modèle.',
      },
    },
  } as Dictionary,
};

export default fragment;
