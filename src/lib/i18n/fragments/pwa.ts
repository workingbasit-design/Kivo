import type { Dictionary } from '../en';

/**
 * PWA install prompt + push notification settings.
 * Every key exists in both en and fr.
 */
const fragment = {
  en: {
    pwa: {
      install: {
        title: 'Install EveryJob',
        body: 'Add EveryJob to your home screen for quick access — no app store download needed.',
        installBtn: 'Install',
        dismissBtn: 'Not now',
      },
      push: {
        cardTitle: 'Push notifications',
        cardDesc:
          'Get notified on this device about new jobs, messages and reminders. Free — no app store download.',
        enableBtn: 'Enable notifications',
        disableBtn: 'Disable notifications',
        testBtn: 'Send test notification',
        testing: 'Sending…',
        enableHelp: 'Your browser will ask for permission first.',
        statusOn: 'On',
        statusOff: 'Off',
        notSupported: "Push notifications aren't supported in this browser.",
        notConfigured:
          "Push notifications aren't set up on the server yet. Ask your administrator to add the VAPID keys.",
        denied: 'Notifications are blocked.',
        deniedHelp: 'Allow notifications for this site in your browser settings, then try again.',
        enabledToast: 'Notifications enabled on this device.',
        disabledToast: 'Notifications disabled on this device.',
        subscribeFailed: "Couldn't enable notifications. Please try again.",
        testSent: 'Test notification sent — check your device.',
        testFailed: "Couldn't send the test notification.",
        testTitle: 'EveryJob test notification',
        testBody: 'Push notifications are working on this device.',
      },
    },
  },
  fr: {
    pwa: {
      install: {
        title: 'Installer EveryJob',
        body: 'Ajoutez EveryJob à votre écran d’accueil pour un accès rapide — sans passer par une boutique d’applications.',
        installBtn: 'Installer',
        dismissBtn: 'Pas maintenant',
      },
      push: {
        cardTitle: 'Notifications push',
        cardDesc:
          'Recevez des notifications sur cet appareil pour les nouveaux travaux, messages et rappels. Gratuit — aucun téléchargement requis.',
        enableBtn: 'Activer les notifications',
        disableBtn: 'Désactiver les notifications',
        testBtn: 'Envoyer une notification d’essai',
        testing: 'Envoi…',
        enableHelp: 'Votre navigateur vous demandera d’abord votre autorisation.',
        statusOn: 'Activées',
        statusOff: 'Désactivées',
        notSupported: 'Les notifications push ne sont pas prises en charge dans ce navigateur.',
        notConfigured:
          'Les notifications push ne sont pas encore configurées sur le serveur. Demandez à votre administrateur d’ajouter les clés VAPID.',
        denied: 'Les notifications sont bloquées.',
        deniedHelp:
          'Autorisez les notifications pour ce site dans les réglages de votre navigateur, puis réessayez.',
        enabledToast: 'Notifications activées sur cet appareil.',
        disabledToast: 'Notifications désactivées sur cet appareil.',
        subscribeFailed: 'Impossible d’activer les notifications. Veuillez réessayer.',
        testSent: 'Notification d’essai envoyée — vérifiez votre appareil.',
        testFailed: 'Impossible d’envoyer la notification d’essai.',
        testTitle: 'Notification d’essai EveryJob',
        testBody: 'Les notifications push fonctionnent sur cet appareil.',
      },
    },
  },
} as const;

export default fragment;
