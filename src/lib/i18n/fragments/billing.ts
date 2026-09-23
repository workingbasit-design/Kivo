import type { Dictionary } from '../en';

/**
 * Track 8C strings: batch invoicing + milestone / progress invoicing.
 * Every key exists in both en and fr. Unique top-level `billing` namespace.
 */
const fragment = {
  en: {
    billing: {
      batchTitle: 'Batch invoicing',
      batchSubtitle:
        'Every completed job without an invoice is listed here. Tick the ones you want to bill — one invoice per job, nothing is created until you confirm.',
      colCustomer: 'Customer',
      colJob: 'Job',
      colDate: 'Date',
      colSubtotal: 'Subtotal',
      colTax: 'Tax',
      colTotal: 'Total',
      selectAll: 'Select all',
      selected: '{count} selected',
      grandTotal: 'Grand total',
      createInvoices: 'Create {count} invoice(s)',
      creating: 'Creating…',
      batchCreated: '{count} invoice(s) created.',
      batchDone: 'Batch invoicing complete',
      viewInvoices: 'View invoices',
      emptyTitle: 'Nothing to invoice',
      emptyDesc:
        'Every completed job already has an invoice. Mark a job complete and it will show up here.',
      loadError: 'Could not load the invoice preview. Please try again.',
      errors: {
        generic: 'Something went wrong. Please try again.',
        loginAgain: 'Please log in again.',
        tooMany: 'Too many requests. Please wait a moment and try again.',
        nothingSelected: 'Select at least one job to invoice.',
        someInvalid:
          'Some jobs are no longer eligible (already invoiced or not completed). Nothing was created — refresh and try again.',
        jobNotFound: 'Job not found.',
        jobCancelled: 'Cancelled jobs can\'t be invoiced.',
        labelRequired: 'Milestone label is required.',
        labelTooLong: 'Milestone label must be 80 characters or fewer.',
        amountInvalid: 'Enter a valid amount.',
        amountTooSmall: 'Amount must be greater than zero.',
        amountTooLarge: 'Amount must be $1,000,000 or less.',
        descriptionTooLong: 'Description must be 2,000 characters or fewer.',
      },
      progressTitle: 'Progress invoicing',
      progressDesc:
        'Bill this job in parts — a deposit, a milestone, or a final payment. Each milestone becomes its own invoice linked to this job.',
      existingInvoices: 'Progress invoices',
      noProgressInvoices: 'No progress invoices yet.',
      labelLabel: 'Milestone label',
      labelPlaceholder: 'e.g. Deposit, Milestone 2 — rough-in, Final',
      amountLabel: 'Amount ($)',
      amountPlaceholder: '0.00',
      descriptionLabel: 'Description (optional)',
      descriptionPlaceholder: 'What does this milestone cover?',
      createMilestone: 'Create milestone invoice',
      milestoneCreated: 'Milestone invoice created.',
      milestoneBadge: 'Progress',
    },
  },
  fr: {
    billing: {
      batchTitle: 'Facturation par lot',
      batchSubtitle:
        'Tous les travaux terminés sans facture sont listés ici. Cochez ceux à facturer — une facture par travail, rien n’est créé avant votre confirmation.',
      colCustomer: 'Client',
      colJob: 'Travail',
      colDate: 'Date',
      colSubtotal: 'Sous-total',
      colTax: 'Taxe',
      colTotal: 'Total',
      selectAll: 'Tout sélectionner',
      selected: '{count} sélectionné(s)',
      grandTotal: 'Total général',
      createInvoices: 'Créer {count} facture(s)',
      creating: 'Création…',
      batchCreated: '{count} facture(s) créée(s).',
      batchDone: 'Facturation par lot terminée',
      viewInvoices: 'Voir les factures',
      emptyTitle: 'Rien à facturer',
      emptyDesc:
        'Tous les travaux terminés ont déjà une facture. Marquez un travail comme terminé et il apparaîtra ici.',
      loadError: 'Impossible de charger l’aperçu. Veuillez réessayer.',
      errors: {
        generic: 'Une erreur est survenue. Veuillez réessayer.',
        loginAgain: 'Veuillez vous reconnecter.',
        tooMany: 'Trop de requêtes. Patientez un moment et réessayez.',
        nothingSelected: 'Sélectionnez au moins un travail à facturer.',
        someInvalid:
          'Certains travaux ne sont plus admissibles (déjà facturés ou non terminés). Rien n’a été créé — actualisez et réessayez.',
        jobNotFound: 'Travail introuvable.',
        jobCancelled: 'Les travaux annulés ne peuvent pas être facturés.',
        labelRequired: 'Le libellé de l’étape est requis.',
        labelTooLong: 'Le libellé doit contenir 80 caractères ou moins.',
        amountInvalid: 'Entrez un montant valide.',
        amountTooSmall: 'Le montant doit être supérieur à zéro.',
        amountTooLarge: 'Le montant doit être de 1 000 000 $ ou moins.',
        descriptionTooLong: 'La description doit contenir 2 000 caractères ou moins.',
      },
      progressTitle: 'Facturation par étapes',
      progressDesc:
        'Facturez ce travail en plusieurs parties — un acompte, une étape ou un paiement final. Chaque étape devient sa propre facture liée à ce travail.',
      existingInvoices: 'Factures d’étapes',
      noProgressInvoices: 'Aucune facture d’étape pour le moment.',
      labelLabel: 'Libellé de l’étape',
      labelPlaceholder: 'p. ex. Acompte, Étape 2 — dégrossissage, Final',
      amountLabel: 'Montant ($)',
      amountPlaceholder: '0,00',
      descriptionLabel: 'Description (facultatif)',
      descriptionPlaceholder: 'Que couvre cette étape?',
      createMilestone: 'Créer la facture d’étape',
      milestoneCreated: 'Facture d’étape créée.',
      milestoneBadge: 'Étape',
    },
  },
} as const;

export default fragment;
