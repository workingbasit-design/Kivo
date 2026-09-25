import type { Dictionary } from '../en';

/**
 * QuickBooks Online sync card. Every key exists in both en and fr.
 */
const fragment = {
  en: {
    quickbooks: {
      cardTitle: 'QuickBooks sync',
      cardDesc:
        'Push customers, open invoices and completed payments to QuickBooks Online. Every record is accounted for — synced, failed or skipped, always with a reason.',
      connectBtn: 'Connect QuickBooks',
      connecting: 'Connecting…',
      disconnectBtn: 'Disconnect',
      disconnectTitle: 'Disconnect QuickBooks?',
      disconnectMsg:
        'EveryJob will stop syncing to QuickBooks. Your sync history stays as an audit trail.',
      syncNowBtn: 'Sync now',
      syncing: 'Syncing…',
      connected: 'Connected',
      notConnected: 'Not connected',
      lastSync: 'Last sync',
      never: 'Never',
      sandboxBadge: 'Sandbox mode',
      setupTitle: 'Connect QuickBooks in 3 steps',
      setupIntro:
        'QuickBooks needs a free Intuit developer app first — it costs nothing and takes about 5 minutes.',
      setupStep1: 'Create a free app at developer.intuit.com, choosing the Accounting API scope.',
      setupStep2: 'Add this redirect URI in your app’s Keys & OAuth settings:',
      setupStep3: 'Copy the Client ID and Client Secret into QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET, redeploy, then connect below.',
      statusConnected: 'QuickBooks is connected — your books stay in sync.',
      statusDenied: 'The QuickBooks connection was cancelled.',
      statusError: 'Something went wrong connecting to QuickBooks. Please try again.',
      statusInvalid: 'The connection attempt expired. Please try again.',
      statusRateLimited: 'Too many attempts — please wait a moment and try again.',
      synced: 'Synced',
      failed: 'Failed',
      skipped: 'Skipped',
      summaryTitle: 'Last sync result',
      noItems: 'Nothing to sync — everything is already in QuickBooks.',
      disconnected: 'QuickBooks disconnected.',
      syncStarted: 'Sync finished — see the per-record results below.',
    },
  },
  fr: {
    quickbooks: {
      cardTitle: 'Synchronisation QuickBooks',
      cardDesc:
        'Envoyez clients, factures impayées et paiements reçus vers QuickBooks en ligne. Chaque enregistrement est comptabilisé — synchronisé, échoué ou ignoré, toujours avec une raison.',
      connectBtn: 'Connecter QuickBooks',
      connecting: 'Connexion…',
      disconnectBtn: 'Déconnecter',
      disconnectTitle: 'Déconnecter QuickBooks?',
      disconnectMsg:
        'EveryJob cessera de synchroniser vers QuickBooks. Votre historique de synchronisation est conservé comme piste d’audit.',
      syncNowBtn: 'Synchroniser',
      syncing: 'Synchronisation…',
      connected: 'Connecté',
      notConnected: 'Non connecté',
      lastSync: 'Dernière synchro',
      never: 'Jamais',
      sandboxBadge: 'Mode bac à sable',
      setupTitle: 'Connectez QuickBooks en 3 étapes',
      setupIntro:
        'QuickBooks exige d’abord une application développeur Intuit gratuite — sans frais, environ 5 minutes.',
      setupStep1: 'Créez une application gratuite sur developer.intuit.com avec la portée Accounting API.',
      setupStep2: 'Ajoutez cette URI de redirection dans les paramètres Keys & OAuth de votre application :',
      setupStep3: 'Copiez le Client ID et le Client Secret dans QUICKBOOKS_CLIENT_ID et QUICKBOOKS_CLIENT_SECRET, redéployez, puis connectez ci-dessous.',
      statusConnected: 'QuickBooks est connecté — votre comptabilité reste synchronisée.',
      statusDenied: 'La connexion à QuickBooks a été annulée.',
      statusError: 'Un problème est survenu lors de la connexion à QuickBooks. Réessayez.',
      statusInvalid: 'La tentative de connexion a expiré. Réessayez.',
      statusRateLimited: 'Trop de tentatives — patientez un instant puis réessayez.',
      synced: 'Synchronisé',
      failed: 'Échoué',
      skipped: 'Ignoré',
      summaryTitle: 'Résultat de la dernière synchro',
      noItems: 'Rien à synchroniser — tout est déjà dans QuickBooks.',
      disconnected: 'QuickBooks déconnecté.',
      syncStarted: 'Synchro terminée — voir les résultats par enregistrement ci-dessous.',
    },
  },
} as const;

export default fragment;
