/**
 * Track 7 — Google sign-in + contact number. `as const` fragment;
 * registered in ../fragments.ts.
 */
export default {
  en: {
    googleAuth: {
      continueWithGoogle: 'Continue with Google',
      orDivider: 'or',
      signInFailed: 'Google sign-in failed. Please try again.',
      signInFailedReason: 'Google sign-in failed: {reason}. Please try again.',
      notConfigured:
        'Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then try again.',
      emailUnverified:
        'This Google account has an unverified email address. Verify it with Google first, then try again.',
      sessionMismatch: 'Sign-in session expired. Please try again.',
      welcomeTitle: 'Welcome to EveryJob',
      welcomeSubtitle:
        'Your workspace is ready. Add a Canadian contact number so customers can reach you — you can skip this and add it later in Settings.',
      businessNameLabel: 'Business name',
      businessNamePlaceholder: 'e.g. Martin Roy Plumbing',
      phoneLabel: 'Contact number (Canada)',
      phonePlaceholder: '(416) 555-1234',
      phoneHint: 'A Canadian 10-digit number. Used on quotes and invoices.',
      phoneRequired: 'Please enter your contact number, or skip for now.',
      phoneInvalid:
        'That doesn’t look like a valid Canadian number. Use a 10-digit number like (416) 555-1234.',
      saveAndContinue: 'Save and continue',
      skipForNow: 'Skip for now',
      save: 'Save',
      profileTitle: 'Your account',
      profileSubtitle: 'Your sign-in details. Your contact number appears on quotes and invoices.',
      nameLabel: 'Your name',
      profileSaved: 'Your account details were saved.',
      googleLinked: 'Google sign-in is linked to this account.',
      signInMethod: 'Signed in with',
      signInMethodGoogle: 'Google',
      signInMethodPassword: 'Email + password',
    },
  },
  fr: {
    googleAuth: {
      continueWithGoogle: 'Continuer avec Google',
      orDivider: 'ou',
      signInFailed: 'La connexion avec Google a échoué. Veuillez réessayer.',
      signInFailedReason: 'La connexion avec Google a échoué : {reason}. Veuillez réessayer.',
      notConfigured:
        'La connexion avec Google n’est pas encore configurée. Ajoutez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET, puis réessayez.',
      emailUnverified:
        'Ce compte Google a une adresse courriel non vérifiée. Vérifiez-la auprès de Google, puis réessayez.',
      sessionMismatch: 'La session de connexion a expiré. Veuillez réessayer.',
      welcomeTitle: 'Bienvenue à EveryJob',
      welcomeSubtitle:
        'Votre espace de travail est prêt. Ajoutez un numéro de téléphone canadien pour que vos clients puissent vous joindre — vous pouvez passer cette étape et l’ajouter plus tard dans les Réglages.',
      businessNameLabel: 'Nom de l’entreprise',
      businessNamePlaceholder: 'p. ex. Plomberie Martin Roy',
      phoneLabel: 'Numéro de téléphone (Canada)',
      phonePlaceholder: '(416) 555-1234',
      phoneHint: 'Un numéro canadien à 10 chiffres. Utilisé sur les soumissions et les factures.',
      phoneRequired: 'Veuillez entrer votre numéro de téléphone, ou passez cette étape.',
      phoneInvalid:
        'Ce numéro ne semble pas valide au Canada. Utilisez un numéro à 10 chiffres comme (416) 555-1234.',
      saveAndContinue: 'Enregistrer et continuer',
      skipForNow: 'Passer pour l’instant',
      save: 'Enregistrer',
      profileTitle: 'Votre compte',
      profileSubtitle: 'Vos informations de connexion. Votre numéro apparaît sur les soumissions et les factures.',
      nameLabel: 'Votre nom',
      profileSaved: 'Vos informations de compte ont été enregistrées.',
      googleLinked: 'La connexion avec Google est liée à ce compte.',
      signInMethod: 'Connecté avec',
      signInMethodGoogle: 'Google',
      signInMethodPassword: 'Courriel + mot de passe',
    },
  },
} as const;
