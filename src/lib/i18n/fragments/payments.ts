/**
 * Owner-side "Collect payment" flow for invoices: create a Stripe Checkout
 * payment link from the invoice detail view, plus the graceful
 * Stripe-not-connected hint. Customer-facing pay strings live under the
 * existing `payments` namespace (track9.ts); these are owner-facing.
 * Every key exists in both en and fr.
 */
const fragment = {
  en: {
    invoicePay: {
      collectPayment: 'Collect payment',
      amountDue: 'Amount due',
      collectDesc:
        'Create a secure card-payment link for this invoice. The customer pays on Stripe — the money settles straight to your connected account.',
      linkReady: 'Payment link ready',
      linkHint:
        'Send this link to your customer (text or email). It opens secure Stripe checkout for the remaining balance.',
      copyLink: 'Copy link',
      copied: 'Copied',
      newLink: 'Create a new link',
      creating: 'Creating secure link…',
      createError: 'Could not create the payment link. Try again.',
      alreadyPaid: 'This invoice is already paid in full.',
      testNote: 'Test mode — no real charge will be made.',
      feeNote: 'EveryJob takes no fee. Card processing fees are set by Stripe.',
      notConnectedTitle: 'Card payments not enabled',
      notConnectedDesc:
        'Connect your Stripe account to collect card payments online. Money settles directly to you — EveryJob never holds funds.',
      goToPayments: 'Go to Payments settings',
    },
  },
  fr: {
    invoicePay: {
      collectPayment: 'Encaisser le paiement',
      amountDue: 'Montant dû',
      collectDesc:
        'Créez un lien de paiement par carte sécurisé pour cette facture. Le client paie sur Stripe — l’argent est versé directement à votre compte connecté.',
      linkReady: 'Lien de paiement prêt',
      linkHint:
        'Envoyez ce lien à votre client (texto ou courriel). Il ouvre le paiement sécurisé Stripe pour le solde restant.',
      copyLink: 'Copier le lien',
      copied: 'Copié',
      newLink: 'Créer un nouveau lien',
      creating: 'Création du lien sécurisé…',
      createError: 'Impossible de créer le lien de paiement. Réessayez.',
      alreadyPaid: 'Cette facture est déjà payée en totalité.',
      testNote: 'Mode test — aucun vrai paiement ne sera effectué.',
      feeNote: 'EveryJob ne prend aucune commission. Les frais de traitement sont fixés par Stripe.',
      notConnectedTitle: 'Paiements par carte non activés',
      notConnectedDesc:
        'Connectez votre compte Stripe pour encaisser des paiements par carte en ligne. L’argent est versé directement à vous — EveryJob ne détient jamais les fonds.',
      goToPayments: 'Aller aux paramètres de paiement',
    },
  },
} as const;

export default fragment;
