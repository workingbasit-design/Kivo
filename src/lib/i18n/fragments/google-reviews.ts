import type { Dictionary } from '../en';

/**
 * Google review sync strings (Track 5). Every key exists in both en and fr.
 */
const fragment = {
  en: {
    googleReviews: {
      title: 'Google reviews',
      setupTitle: 'Google sync isn’t configured yet',
      setupStep1:
        'Create a project at console.cloud.google.com (or use an existing one).',
      setupStep2:
        'Enable these APIs in “APIs & Services → Library”: My Business Account Management API, My Business Business Information API, and Google My Business API (reviews). Note: Google may require you to request access to the Business Profile APIs.',
      setupStep3:
        'Create an OAuth client (Web application) and add this redirect URI:',
      setupStep4:
        'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as environment variables on Vercel, then redeploy.',
      setupNote:
        'Only the business owner needs to do this once — afterwards, syncing is one tap.',
      connectDesc:
        'Import your Google reviews with one tap. You’ll sign in with Google and pick your business — nothing is imported until you press Sync now.',
      connectButton: 'Connect Google',
      pickTitle: 'Which Google business is yours?',
      loadingLocations: 'Loading your locations…',
      noLocations: 'No Google business locations found on this account.',
      loadLocationsError: 'Could not load locations.',
      useThis: 'Use this',
      reloadLocations: 'Reload locations',
      connectedAs: 'Connected as {name}.',
      connectedNoName: 'Connected.',
      lastSync: 'Last synced {when}.',
      syncNow: 'Sync now',
      syncing: 'Syncing…',
      disconnect: 'Disconnect',
      disconnectConfirm:
        'Disconnect Google? Your imported reviews stay, but syncing will stop until you reconnect.',
      disconnected: 'Google disconnected.',
      syncNote:
        'Sync imports only new reviews — your manual reviews are never changed or duplicated.',
      synced: 'Synced',
      newReviews: 'new reviews',
      alreadyHere: 'already here',
      syncFailed: 'Sync failed.',
      locationSaved: 'Business selected — press Sync now to import reviews.',
      couldNotSave: 'Could not save.',
      statusConnected:
        'Google connected. Choose your business location below, then sync.',
      statusDenied:
        'You declined the Google consent screen — nothing was connected.',
      statusNotConfigured:
        'Google sign-in is not configured on this install yet.',
      statusError: 'Something went wrong with Google. Please try again.',
    },
  } as Dictionary,
  fr: {
    googleReviews: {
      title: 'Avis Google',
      setupTitle: 'La synchro Google n’est pas configurée',
      setupStep1:
        'Créez un projet sur console.cloud.google.com (ou utilisez-en un existant).',
      setupStep2:
        'Activez ces API dans « API et services → Bibliothèque » : My Business Account Management API, My Business Business Information API et Google My Business API (avis). Remarque : Google peut exiger une demande d’accès aux API Business Profile.',
      setupStep3:
        'Créez un client OAuth (application Web) et ajoutez cet URI de redirection :',
      setupStep4:
        'Définissez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET comme variables d’environnement sur Vercel, puis redéployez.',
      setupNote:
        'Seul le propriétaire de l’entreprise doit le faire une fois — ensuite, la synchro se fait en un clic.',
      connectDesc:
        'Importez vos avis Google en un clic. Vous vous connecterez avec Google et choisirez votre établissement — rien n’est importé avant d’appuyer sur Synchroniser.',
      connectButton: 'Connecter Google',
      pickTitle: 'Quel est votre établissement Google ?',
      loadingLocations: 'Chargement de vos établissements…',
      noLocations: 'Aucun établissement Google trouvé sur ce compte.',
      loadLocationsError: 'Impossible de charger les établissements.',
      useThis: 'Utiliser',
      reloadLocations: 'Recharger',
      connectedAs: 'Connecté en tant que {name}.',
      connectedNoName: 'Connecté.',
      lastSync: 'Dernière synchro : {when}.',
      syncNow: 'Synchroniser',
      syncing: 'Synchronisation…',
      disconnect: 'Déconnecter',
      disconnectConfirm:
        'Déconnecter Google ? Vos avis importés restent, mais la synchro s’arrêtera jusqu’à votre reconnexion.',
      disconnected: 'Google déconnecté.',
      syncNote:
        'La synchro n’importe que les nouveaux avis — vos avis manuels ne sont jamais modifiés ni dupliqués.',
      synced: 'Synchro terminée',
      newReviews: 'nouveaux avis',
      alreadyHere: 'déjà ici',
      syncFailed: 'Échec de la synchro.',
      locationSaved:
        'Établissement sélectionné — appuyez sur Synchroniser pour importer les avis.',
      couldNotSave: 'Enregistrement impossible.',
      statusConnected:
        'Google connecté. Choisissez votre établissement ci-dessous, puis synchronisez.',
      statusDenied:
        'Vous avez refusé l’écran de consentement Google — rien n’a été connecté.',
      statusNotConfigured:
        'La connexion Google n’est pas encore configurée sur cette installation.',
      statusError: 'Un problème est survenu avec Google. Veuillez réessayer.',
    },
  } as Dictionary,
} as const;

export default fragment;
