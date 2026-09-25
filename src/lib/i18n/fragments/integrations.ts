import type { Dictionary } from '../en';

/**
 * Integrations: API keys, webhooks, Google Calendar sync.
 * Every key exists in both en and fr.
 */
const fragment = {
  en: {
    integrations: {
      title: 'Integrations',
      subtitle: 'Connect EveryJob to the tools you already use. API and webhooks are free on every plan.',
      apiKeysTitle: 'API keys',
      apiKeysDesc:
        'Use keys to call the EveryJob REST API (v1): list and create customers, jobs, and invoices. Send the key as Authorization: Bearer ejk_live_…',
      keyNamePh: 'e.g. Zapier production',
      scopeRead: 'Read only',
      scopeWrite: 'Read + write',
      createKey: 'Create key',
      keyCreatedTitle: 'Copy your key now',
      keyCreatedDesc:
        'This is the only time the full key is shown. Store it somewhere safe — it cannot be recovered.',
      copied: 'Copied to clipboard.',
      revoke: 'Revoke',
      revokeConfirm: 'Revoke this API key? Integrations using it will stop working.',
      revoked: 'API key revoked.',
      keyCreated: 'API key created.',
      noKeys: 'No API keys yet.',
      lastUsed: 'Last used',
      neverUsed: 'Never used',
      webhooksTitle: 'Webhooks',
      webhooksDesc:
        'EveryJob POSTs JSON to your URL when things happen — connect Zapier or Make to automate follow-ups, spreadsheets, and notifications.',
      endpointUrlPh: 'https://hooks.zapier.com/hooks/catch/…',
      eventsLabel: 'Events',
      addEndpoint: 'Add endpoint',
      secretTitle: 'Copy your signing secret',
      secretDesc:
        'Verify the X-EveryJob-Signature header (HMAC-SHA256 of the raw body) with this secret to prove events came from EveryJob.',
      endpointAdded: 'Webhook endpoint added.',
      endpointRemoved: 'Endpoint removed.',
      removeConfirm: 'Remove this endpoint? Deliveries stop immediately.',
      pause: 'Pause',
      resume: 'Resume',
      noEndpoints: 'No webhook endpoints yet.',
      deliveriesTitle: 'Recent deliveries',
      noDeliveries: 'No deliveries yet — events will appear here.',
      statusPending: 'Pending',
      statusDelivered: 'Delivered',
      statusFailed: 'Failed',
      attempts: 'attempts',
      zapierTitle: 'Works with Zapier & Make',
      zapierStep1:
        'In Zapier, create a Zap with the “Webhooks by Zapier” trigger → Catch Hook. Copy the hook URL.',
      zapierStep2:
        'Paste it above, pick your events, and add the endpoint. Trigger an event (e.g. create a job) to send a sample.',
      zapierStep3:
        'Add a Filter step: only continue when the X-EveryJob-Signature header matches HMAC-SHA256 of the raw body with your secret.',
      zapierStep4:
        'In Make, use the Custom Webhook module the same way — paste the webhook URL above and map the JSON fields.',
      calendarTitle: 'Google Calendar',
      calendarDesc:
        'One-way sync: your scheduled jobs appear on your Google Calendar automatically. EveryJob stays the source of truth.',
      calendarConnected: 'Connected — jobs sync automatically.',
      calendarNotConnected: 'Not connected.',
      calendarNeedsScope: 'Reconnect Google to grant calendar access, then sync starts automatically.',
      calendarSyncNow: 'Sync now',
      calendarSynced: 'Calendar synced.',
      calendarSyncFailed: 'Sync failed — try reconnecting Google.',
      connectGoogle: 'Connect Google',
      docsNote: 'Full API docs: GET/POST /api/v1/customers, /api/v1/jobs, /api/v1/invoices with your key.',
    },
  },
  fr: {
    integrations: {
      title: 'Intégrations',
      subtitle: 'Connectez EveryJob aux outils que vous utilisez déjà. API et webhooks gratuits sur tous les forfaits.',
      apiKeysTitle: 'Clés API',
      apiKeysDesc:
        'Utilisez des clés pour appeler l’API REST EveryJob (v1) : lister et créer clients, tâches et factures. Envoyez la clé comme Authorization: Bearer ejk_live_…',
      keyNamePh: 'p. ex. Zapier production',
      scopeRead: 'Lecture seule',
      scopeWrite: 'Lecture + écriture',
      createKey: 'Créer une clé',
      keyCreatedTitle: 'Copiez votre clé maintenant',
      keyCreatedDesc:
        'C’est la seule fois où la clé complète est affichée. Conservez-la en lieu sûr — elle ne peut pas être récupérée.',
      copied: 'Copié dans le presse-papiers.',
      revoke: 'Révoquer',
      revokeConfirm: 'Révoquer cette clé API? Les intégrations qui l’utilisent cesseront de fonctionner.',
      revoked: 'Clé API révoquée.',
      keyCreated: 'Clé API créée.',
      noKeys: 'Aucune clé API pour l’instant.',
      lastUsed: 'Dernière utilisation',
      neverUsed: 'Jamais utilisée',
      webhooksTitle: 'Webhooks',
      webhooksDesc:
        'EveryJob envoie du JSON à votre URL quand des événements surviennent — connectez Zapier ou Make pour automatiser suivis, tableurs et notifications.',
      endpointUrlPh: 'https://hooks.zapier.com/hooks/catch/…',
      eventsLabel: 'Événements',
      addEndpoint: 'Ajouter un point de terminaison',
      secretTitle: 'Copiez votre secret de signature',
      secretDesc:
        'Vérifiez l’en-tête X-EveryJob-Signature (HMAC-SHA256 du corps brut) avec ce secret pour prouver que les événements viennent d’EveryJob.',
      endpointAdded: 'Point de terminaison ajouté.',
      endpointRemoved: 'Point de terminaison retiré.',
      removeConfirm: 'Retirer ce point de terminaison? Les envois cessent immédiatement.',
      pause: 'Suspendre',
      resume: 'Reprendre',
      noEndpoints: 'Aucun point de terminaison pour l’instant.',
      deliveriesTitle: 'Envois récents',
      noDeliveries: 'Aucun envoi pour l’instant — les événements apparaîtront ici.',
      statusPending: 'En attente',
      statusDelivered: 'Livré',
      statusFailed: 'Échoué',
      attempts: 'tentatives',
      zapierTitle: 'Compatible avec Zapier et Make',
      zapierStep1:
        'Dans Zapier, créez un Zap avec le déclencheur « Webhooks by Zapier » → Catch Hook. Copiez l’URL du hook.',
      zapierStep2:
        'Collez-la ci-dessus, choisissez vos événements et ajoutez le point de terminaison. Déclenchez un événement (p. ex. créez une tâche) pour envoyer un exemple.',
      zapierStep3:
        'Ajoutez une étape Filtre : continuez seulement si l’en-tête X-EveryJob-Signature correspond au HMAC-SHA256 du corps brut avec votre secret.',
      zapierStep4:
        'Dans Make, utilisez le module Custom Webhook de la même façon — collez l’URL ci-dessus et mappez les champs JSON.',
      calendarTitle: 'Google Agenda',
      calendarDesc:
        'Synchronisation unidirectionnelle : vos tâches planifiées apparaissent automatiquement dans votre agenda Google. EveryJob reste la source de vérité.',
      calendarConnected: 'Connecté — les tâches se synchronisent automatiquement.',
      calendarNotConnected: 'Non connecté.',
      calendarNeedsScope: 'Reconnectez Google pour accorder l’accès à l’agenda, puis la synchro démarrera.',
      calendarSyncNow: 'Synchroniser',
      calendarSynced: 'Agenda synchronisé.',
      calendarSyncFailed: 'Échec de la synchro — essayez de reconnecter Google.',
      connectGoogle: 'Connecter Google',
      docsNote: 'Docs API complètes : GET/POST /api/v1/customers, /api/v1/jobs, /api/v1/invoices avec votre clé.',
    },
  },
} as const;

export default fragment;
