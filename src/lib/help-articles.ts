/**
 * Help center article library (server-safe, no I/O).
 *
 * Every article describes what EveryJob ACTUALLY does — claims were verified
 * against the codebase (routes, actions, schema). Never invent features here.
 * Bodies are markdown-ish text (## headings, - bullets, plain paragraphs).
 */

export type HelpCategoryId =
  | 'getting-started'
  | 'customers-work'
  | 'money'
  | 'ai-automation'
  | 'profile'
  | 'help';

export interface HelpCategory {
  id: HelpCategoryId;
  en: string;
  fr: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'getting-started', en: 'Getting started', fr: 'Pour commencer' },
  { id: 'customers-work', en: 'Customers & work', fr: 'Clients et travaux' },
  { id: 'money', en: 'Money', fr: 'Facturation' },
  { id: 'ai-automation', en: 'AI & automation', fr: 'IA et automatisation' },
  { id: 'profile', en: 'Profile & trust', fr: 'Profil et confiance' },
  { id: 'help', en: 'Help', fr: 'Aide' },
];

export interface HelpArticle {
  id: string;
  slug: string;
  category: HelpCategoryId;
  /** Slugs of related articles. Every entry must exist. */
  related: string[];
  en: { title: string; body: string };
  fr: { title: string; body: string };
}

const A: HelpArticle[] = [
  {
    id: 'getting-started',
    slug: 'getting-started',
    category: 'getting-started',
    related: ['customers', 'jobs', 'copilot'],
    en: {
      title: 'Getting started with EveryJob',
      body: `## Welcome to EveryJob

EveryJob is a free job-management app for Canadian home-service businesses. Everything runs in your browser — nothing to install.

## Your first 10 minutes

1. **Sign up** with your email or with Google ("Continue with Google").
2. **Tell us about your business** in Settings: business name, phone, address, working hours and logo. This information appears on your quotes and invoices.
3. **Follow the onboarding checklist** on your dashboard: add your first customer, create your first job, send your first quote or invoice, connect Google, and invite your team.

## Where everything lives

- **Dashboard** — today's jobs and a snapshot of your business.
- **Customers** — your customer list, with search, import and export.
- **Jobs** — every job, moving through a simple pipeline.
- **Schedule** — your jobs on a calendar view.
- **Quotes & Invoices** — send quotes, get them approved, turn them into invoices.
- **Insights** — your profile strength and certification roadmap.
- **Settings** — business details, team, messaging, automations, booking page, payments.

## Stuck? Ask the AI assistant

The EveryJob AI assistant (bottom-right of every page) answers questions about your own data — "How many customers do I have?", "What is my booked revenue this month?" — in English or French. It never creates records without showing you a preview and getting your confirmation first.`,
    },
    fr: {
      title: 'Débuter avec EveryJob',
      body: `## Bienvenue sur EveryJob

EveryJob est une application gratuite de gestion pour les entreprises canadiennes de services à domicile. Tout fonctionne dans votre navigateur — rien à installer.

## Vos 10 premières minutes

1. **Inscrivez-vous** avec votre courriel ou avec Google (« Continuer avec Google »).
2. **Décrivez votre entreprise** dans Paramètres : nom, téléphone, adresse, heures d'ouverture et logo. Ces renseignements apparaissent sur vos soumissions et factures.
3. **Suivez la liste de démarrage** sur votre tableau de bord : ajoutez votre premier client, créez votre premier travail, envoyez votre première soumission ou facture, connectez Google et invitez votre équipe.

## Où tout se trouve

- **Tableau de bord** — les travaux du jour et un aperçu de votre entreprise.
- **Clients** — votre liste de clients, avec recherche, importation et exportation.
- **Travaux** — chaque travail, suivant un pipeline simple.
- **Horaire** — vos travaux sur un calendrier.
- **Soumissions et factures** — envoyez des soumissions, faites-les approuver, convertissez-les en factures.
- **Aperçus** — la solidité de votre profil et votre feuille de route de certification.
- **Paramètres** — coordonnées de l'entreprise, équipe, messagerie, automatisations, page de réservation, paiements.

## Bloqué? Demandez à l'assistant IA

L'assistant IA EveryJob (en bas à droite de chaque page) répond aux questions sur vos propres données — « Combien de clients ai-je? », « Quel est mon revenu réservé ce mois-ci? » — en français ou en anglais. Il ne crée jamais de dossier sans d'abord vous montrer un aperçu et obtenir votre confirmation.`,
    },
  },
  {
    id: 'customers',
    slug: 'customers',
    category: 'customers-work',
    related: ['imports-exports', 'jobs', 'getting-started'],
    en: {
      title: 'Managing customers',
      body: `## Your customer list

The Customers page is your address book. Add customers one by one, search by name, and open any customer to see their jobs, quotes and invoices.

## Adding customers

- **Manually**: click "Add customer" and fill in name, phone, email and address.
- **In bulk**: import a CSV or Excel file (see "Importing and exporting data"). You get a preview with validation, duplicate detection and a confirmation step — nothing is created silently.

## Custom fields

Need to track something specific (gate code, preferred contact time)? Add custom fields to your customers in the customer view.

## Exporting

Export your customer list to CSV or Excel any time, with your current search and filters applied — handy for backups or mail merges.

## The AI assistant can help

Ask the assistant "Add a customer named…" and it will show you a preview of exactly what it is about to create. Nothing is saved until you confirm.`,
    },
    fr: {
      title: 'Gérer vos clients',
      body: `## Votre liste de clients

La page Clients est votre carnet d'adresses. Ajoutez des clients un par un, recherchez par nom, et ouvrez n'importe quel client pour voir ses travaux, soumissions et factures.

## Ajouter des clients

- **Manuellement** : cliquez sur « Ajouter un client » et remplissez le nom, le téléphone, le courriel et l'adresse.
- **En lot** : importez un fichier CSV ou Excel (voir « Importer et exporter des données »). Vous obtenez un aperçu avec validation, détection des doublons et une étape de confirmation — rien n'est créé en silence.

## Champs personnalisés

Besoin de suivre quelque chose de précis (code de porte, moment préféré pour appeler)? Ajoutez des champs personnalisés à vos clients.

## Exportation

Exportez votre liste de clients en CSV ou Excel en tout temps, avec votre recherche et vos filtres appliqués — pratique pour les sauvegardes ou les publipostages.

## L'assistant IA peut aider

Demandez à l'assistant « Ajoute un client nommé… » et il vous montrera un aperçu exact de ce qu'il s'apprête à créer. Rien n'est enregistré avant votre confirmation.`,
    },
  },
  {
    id: 'jobs',
    slug: 'jobs',
    category: 'customers-work',
    related: ['schedule', 'customers', 'quotes'],
    en: {
      title: 'Jobs and the job pipeline',
      body: `## The pipeline

Every job moves forward through a simple pipeline:

**New → Scheduled → In progress → Completed → Paid**

Moves are forward-only: the app only offers the next legal step, so a job can never accidentally jump backwards.

## Cancelling and reopening

- You can **cancel** a job from any status except Paid or already-Cancelled.
- A **cancelled** job can be **reopened** as New or Scheduled.
- Cancelled jobs are excluded from your booked-revenue totals and from "jobs left" counts.

## Prices with cents

Job prices accept cents (for example $249.99) and all money math is rounded to two decimals.

## Recurring jobs

Jobs can repeat on a schedule — set the recurrence when you create the job and EveryJob generates the upcoming occurrences for you.

## What the AI assistant knows

Ask "What is my total booked revenue this month?" and the assistant totals your scheduled (non-cancelled) jobs for the current calendar month — separate from payments you've actually collected.`,
    },
    fr: {
      title: 'Travaux et pipeline des travaux',
      body: `## Le pipeline

Chaque travail avance dans un pipeline simple :

**Nouveau → Planifié → En cours → Terminé → Payé**

Les déplacements se font vers l'avant seulement : l'application ne propose que la prochaine étape permise, un travail ne peut donc jamais reculer par accident.

## Annuler et rouvrir

- Vous pouvez **annuler** un travail à n'importe quelle étape, sauf s'il est Payé ou déjà Annulé.
- Un travail **annulé** peut être **rouvert** comme Nouveau ou Planifié.
- Les travaux annulés sont exclus de vos totaux de revenus réservés et du compte de travaux restants.

## Prix avec cents

Les prix acceptent les cents (par exemple 249,99 $) et tous les calculs sont arrondis à deux décimales.

## Travaux récurrents

Les travaux peuvent se répéter selon un horaire — définissez la récurrence à la création et EveryJob génère les prochaines occurrences pour vous.

## Ce que l'assistant IA sait

Demandez « Quel est mon revenu réservé ce mois-ci? » et l'assistant totalise vos travaux planifiés (non annulés) du mois civil en cours — séparément des paiements réellement encaissés.`,
    },
  },
  {
    id: 'schedule',
    slug: 'schedule',
    category: 'customers-work',
    related: ['jobs', 'timesheets'],
    en: {
      title: 'Using the schedule',
      body: `## Your work week at a glance

The Schedule page shows your jobs on a calendar so you can see what is booked, what is in progress, and what still needs scheduling.

## Scheduling a job

Open a job and set its scheduled date and time. It appears on the schedule and on your dashboard's "today" view.

## Removing from the schedule

Jobs can be removed from the schedule without deleting them — they go back to the job list and can be rescheduled later.

## Time tracking

Use Timesheets to log hours against jobs and keep a record of who worked what, when.`,
    },
    fr: {
      title: 'Utiliser l’horaire',
      body: `## Votre semaine de travail en un coup d'œil

La page Horaire affiche vos travaux sur un calendrier pour voir ce qui est réservé, ce qui est en cours et ce qui reste à planifier.

## Planifier un travail

Ouvrez un travail et définissez sa date et son heure. Il apparaît à l'horaire et dans la vue « aujourd'hui » de votre tableau de bord.

## Retirer de l'horaire

Un travail peut être retiré de l'horaire sans être supprimé — il retourne à la liste des travaux et peut être replanifié plus tard.

## Suivi du temps

Utilisez les Feuilles de temps pour consigner les heures sur les travaux et garder une trace de qui a fait quoi, et quand.`,
    },
  },
  {
    id: 'quotes',
    slug: 'quotes',
    category: 'customers-work',
    related: ['invoices', 'jobs', 'imports-exports'],
    en: {
      title: 'Quotes: send, approve, convert',
      body: `## Quote statuses

Quotes move through **Draft → Sent → Approved** (or **Declined**). Only send a quote when it is ready for the customer to see.

## Electronic signatures

Customers can sign quotes electronically: EveryJob generates a secure public signing link, and once signed you get a signed PDF for your records. No paper, no scanning.

## Turning quotes into jobs and invoices

An approved quote is the starting point for the real work: create the job from it, and later convert it into an invoice without retyping line items.

## Follow-ups, automatically

Turn on the quote follow-up automation (Settings → Automations) and EveryJob will nudge customers about quotes that are still awaiting an answer after the number of days you choose.`,
    },
    fr: {
      title: 'Soumissions : envoyer, approuver, convertir',
      body: `## Statuts des soumissions

Les soumissions passent par **Brouillon → Envoyée → Approuvée** (ou **Refusée**). N'envoyez une soumission que lorsqu'elle est prête à être vue par le client.

## Signatures électroniques

Les clients peuvent signer électroniquement : EveryJob génère un lien de signature public sécurisé, et une fois signé vous obtenez un PDF signé pour vos dossiers. Ni papier, ni numérisation.

## Convertir en travaux et factures

Une soumission approuvée est le point de départ du vrai travail : créez-en le travail, puis convertissez-la en facture sans retaper les lignes.

## Relances automatiques

Activez la relance de soumissions (Paramètres → Automatisations) et EveryJob relancera les clients dont la soumission attend toujours une réponse après le nombre de jours que vous choisissez.`,
    },
  },
  {
    id: 'timesheets',
    slug: 'timesheets',
    category: 'customers-work',
    related: ['schedule', 'jobs'],
    en: {
      title: 'Timesheets',
      body: `## Track who worked what

Timesheets keep a simple record of hours worked — by whom, on which job, and when.

## Why it matters

- **Payroll**: a clean record of hours per team member.
- **Job costing**: compare hours logged against what you quoted.
- **Proof**: a paper trail if a customer questions the time billed.

Open Timesheets from the main navigation to log and review time entries.`,
    },
    fr: {
      title: 'Feuilles de temps',
      body: `## Suivez qui a fait quoi

Les feuilles de temps gardent un registre simple des heures travaillées — par qui, sur quel travail, et quand.

## Pourquoi c'est utile

- **Paie** : un registre clair des heures par membre d'équipe.
- **Coût des travaux** : comparez les heures consignées à ce que vous avez soumissionné.
- **Preuve** : une trace écrite si un client questionne le temps facturé.

Ouvrez Feuilles de temps dans la navigation principale pour saisir et revoir les entrées de temps.`,
    },
  },
  {
    id: 'invoices',
    slug: 'invoices',
    category: 'money',
    related: ['quotes', 'imports-exports', 'automations'],
    en: {
      title: 'Invoices and getting paid',
      body: `## Invoice statuses

Invoices are **Unpaid**, **Partially paid** or **Paid**. Record payments as they come in and the status updates automatically.

## Getting paid online

Connect your own Stripe account in Settings → Payments. Money goes straight to you — EveryJob never holds your funds.

## Overdue reminders, automatically

Turn on invoice reminders (Settings → Automations) and EveryJob will remind customers about upcoming and overdue invoices after the grace period you choose — politely, and only if they consented to messages.

## What the AI assistant knows

Ask "Which invoices are unpaid?" (in English or French) and the assistant lists them from your real data.`,
    },
    fr: {
      title: 'Factures et paiements',
      body: `## Statuts des factures

Les factures sont **Impayées**, **Partiellement payées** ou **Payées**. Enregistrez les paiements au fur et à mesure et le statut se met à jour automatiquement.

## Être payé en ligne

Connectez votre propre compte Stripe dans Paramètres → Paiements. L'argent vous parvient directement — EveryJob ne détient jamais vos fonds.

## Rappels d'impayés automatiques

Activez les rappels de factures (Paramètres → Automatisations) et EveryJob rappellera poliment aux clients les factures à venir et en retard après le délai de grâce que vous choisissez — et seulement s'ils ont consenti aux messages.

## Ce que l'assistant IA sait

Demandez « Quelles factures sont impayées? » (en français ou en anglais) et l'assistant les liste à partir de vos vraies données.`,
    },
  },
  {
    id: 'imports-exports',
    slug: 'imports-exports',
    category: 'money',
    related: ['customers', 'invoices', 'quotes'],
    en: {
      title: 'Importing and exporting data',
      body: `## Importing customers

Bring your existing customer list with a CSV or Excel file (.csv, .xls, .xlsx):

1. Go to Imports and upload your file (Excel reads the first worksheet).
2. **Preview** every row with validation results before anything is created.
3. **Duplicates are flagged** — choose to skip or update them.
4. **Confirm** and only then are the customers created. Nothing is ever created silently.

## Exporting

Export **customers, jobs, quotes and invoices** to CSV or Excel from each page's export button. Your current search and filters are applied, so you export exactly what you see — handy for backups, accountants and mail merges.

## Your data stays yours

Exports are plain files you can open anywhere. There is no lock-in: your business data can leave EveryJob any time you want.`,
    },
    fr: {
      title: 'Importer et exporter des données',
      body: `## Importer des clients

Importez votre liste de clients existante avec un fichier CSV ou Excel (.csv, .xls, .xlsx) :

1. Allez à Importations et téléversez votre fichier (Excel lit la première feuille).
2. **Prévisualisez** chaque ligne avec les résultats de validation avant toute création.
3. **Les doublons sont signalés** — choisissez de les ignorer ou de les mettre à jour.
4. **Confirmez**, et seulement alors les clients sont créés. Rien n'est jamais créé en silence.

## Exporter

Exportez **clients, travaux, soumissions et factures** en CSV ou Excel depuis le bouton d'exportation de chaque page. Votre recherche et vos filtres en cours sont appliqués : vous exportez exactement ce que vous voyez — pratique pour les sauvegardes, les comptables et les publipostages.

## Vos données restent à vous

Les exportations sont des fichiers ordinaires ouvrables partout. Aucune dépendance : vos données d'entreprise peuvent quitter EveryJob quand vous voulez.`,
    },
  },
  {
    id: 'copilot',
    slug: 'copilot',
    category: 'ai-automation',
    related: ['getting-started', 'automations', 'getting-help'],
    en: {
      title: 'The EveryJob AI assistant',
      body: `## What it is

The AI assistant (bottom-right of every page) answers questions about your business using your real data — customers, jobs, quotes, invoices and your credentials.

## What it can do

- **Answer questions**: "How many customers do I have?", "What is my booked revenue this month?", "Which invoices are unpaid?"
- **Draft records with your approval**: ask it to add a customer or create a job and it shows you a **preview** of exactly what will be created. Nothing is saved until you confirm.
- **Explain the app**: "How do I connect Stripe?", "Where do I add a credential?"
- **Speak your language**: ask in English or French, it answers in the same language.

## What it will not do

- **Never creates records silently.** No customer, job or booking appears without your explicit confirmation.
- **Never sends messages.** It drafts; you send.
- **Admits what it doesn't know.** Ask about another business's customer and it tells you it can't find them instead of inventing one. Ask about peer comparisons and it tells you plainly there is no peer data yet.
- **Stays in its lane.** Ask about the weather and it politely declines — it is your business assistant, not a search engine.

## It learns your business

Set your trade and credentials (Settings → Credentials) and the assistant gives tailored answers — for example, pointing Ontario plumbers to the right official certification bodies.`,
    },
    fr: {
      title: 'L’assistant IA EveryJob',
      body: `## Ce que c'est

L'assistant IA (en bas à droite de chaque page) répond aux questions sur votre entreprise à partir de vos vraies données — clients, travaux, soumissions, factures et vos titres de compétence.

## Ce qu'il peut faire

- **Répondre aux questions** : « Combien de clients ai-je? », « Quel est mon revenu réservé ce mois-ci? », « Quelles factures sont impayées? »
- **Préparer des dossiers avec votre approbation** : demandez-lui d'ajouter un client ou de créer un travail et il affiche un **aperçu** exact de ce qui sera créé. Rien n'est enregistré avant votre confirmation.
- **Expliquer l'application** : « Comment connecter Stripe? », « Où ajouter un titre de compétence? »
- **Parler votre langue** : posez la question en français ou en anglais, il répond dans la même langue.

## Ce qu'il ne fera jamais

- **Jamais de création silencieuse.** Aucun client, travail ou rendez-vous n'apparaît sans votre confirmation explicite.
- **Jamais d'envoi de messages.** Il rédige; vous envoyez.
- **Il admet ce qu'il ignore.** Interrogez-le sur le client d'une autre entreprise et il vous dira qu'il ne le trouve pas au lieu d'en inventer un. Demandez une comparaison avec des pairs et il vous dira franchement qu'il n'y a pas encore de données.
- **Il reste dans son rôle.** Demandez la météo et il déclinera poliment — c'est votre assistant d'entreprise, pas un moteur de recherche.

## Il apprend votre métier

Définissez votre métier et vos titres (Paramètres → Titres) et l'assistant donne des réponses adaptées — par exemple, en dirigeant les plombiers ontariens vers les bons organismes officiels de certification.`,
    },
  },
  {
    id: 'automations',
    slug: 'automations',
    category: 'ai-automation',
    related: ['messaging', 'quotes', 'invoices'],
    en: {
      title: 'Automations and reminders',
      body: `## Hands-off follow-ups

Automations (Settings → Automations) handle the chasing for you:

- **Appointment reminders** before scheduled jobs.
- **Invoice reminders** for upcoming and overdue invoices, after a grace period you set.
- **Quote follow-ups** for quotes still awaiting an answer after the days you choose.
- **Review requests** after a job is completed (drafted for your review first).

## You stay in control

Each rule can be toggled on or off individually, and you tune the timing (follow-up days, grace days). Run the engine manually any time and audit recent runs from the same page.

## Safety rails, always on

- **Consent first**: no customer opt-in, no message — ever.
- **Quiet hours**: messages wait for business hours in your timezone.
- **Free quotas**: sending stops hard at the free limit. Nothing can silently cost you money.
- **Drafts, not surprises**: by design, automations are limited to in-app notifications and drafts. Anything that goes to a customer is something you approved.`,
    },
    fr: {
      title: 'Automatisations et rappels',
      body: `## Des relances sans y penser

Les automatisations (Paramètres → Automatisations) s'occupent des relances pour vous :

- **Rappels de rendez-vous** avant les travaux planifiés.
- **Rappels de factures** pour les factures à venir et en retard, après un délai de grâce que vous définissez.
- **Relances de soumissions** pour celles qui attendent toujours une réponse après le nombre de jours choisi.
- **Demandes d'avis** après un travail terminé (rédigées pour votre révision d'abord).

## Vous gardez le contrôle

Chaque règle s'active ou se désactive individuellement, et vous réglez le minutage (jours de relance, délai de grâce). Lancez le moteur manuellement en tout temps et vérifiez les exécutions récentes depuis la même page.

## Garde-fous toujours actifs

- **Consentement d'abord** : sans l'accord du client, aucun message — jamais.
- **Heures de silence** : les messages attendent les heures d'ouverture de votre fuseau horaire.
- **Quotas gratuits** : l'envoi s'arrête net à la limite gratuite. Rien ne peut vous coûter de l'argent en silence.
- **Brouillons, pas de surprises** : par conception, les automatisations se limitent aux notifications internes et aux brouillons. Tout ce qui parvient à un client est quelque chose que vous avez approuvé.`,
    },
  },
  {
    id: 'messaging',
    slug: 'messaging',
    category: 'ai-automation',
    related: ['automations', 'booking'],
    en: {
      title: 'Messaging customers',
      body: `## WhatsApp and email, on free quotas

EveryJob can message your customers over **WhatsApp** and **email** using free-tier providers you connect in Settings → Messaging. A message log shows everything sent.

## The rules are strict — on purpose

1. **Consent (CASL)**: a customer who hasn't opted in never gets a message. Blocked attempts are logged, not sent.
2. **Quiet hours**: messages are deferred to business hours in your timezone.
3. **Provider connected**: each channel needs its provider connected first, or the send fails safely.
4. **Hard quota stop**: sending halts at the free limit and you are notified in-app. The engine cannot silently spend money.

## What about texting (SMS)?

SMS is disabled by design to keep EveryJob free — WhatsApp and email cover customer messaging without per-message charges.`,
    },
    fr: {
      title: 'Envoyer des messages aux clients',
      body: `## WhatsApp et courriel, sur quotas gratuits

EveryJob peut écrire à vos clients par **WhatsApp** et par **courriel** grâce aux fournisseurs gratuits que vous connectez dans Paramètres → Messagerie. Un journal des messages montre tout ce qui a été envoyé.

## Des règles strictes — volontairement

1. **Consentement (LCAP)** : un client qui n'a pas accepté ne reçoit jamais de message. Les tentatives bloquées sont journalisées, pas envoyées.
2. **Heures de silence** : les messages attendent les heures d'ouverture de votre fuseau horaire.
3. **Fournisseur connecté** : chaque canal exige son fournisseur connecté d'abord, sinon l'envoi échoue sans danger.
4. **Arrêt net au quota** : l'envoi s'arrête à la limite gratuite et vous êtes avisé dans l'application. Le moteur ne peut pas dépenser d'argent en silence.

## Et les textos (SMS)?

Les SMS sont désactivés par conception pour garder EveryJob gratuit — WhatsApp et le courriel couvrent la messagerie client sans frais par message.`,
    },
  },
  {
    id: 'booking',
    slug: 'booking',
    category: 'ai-automation',
    related: ['messaging', 'customers'],
    en: {
      title: 'Your online booking page',
      body: `## Let customers book you directly

Turn on your public booking page in Settings → Booking. You get a shareable link (your business's own /book page) where customers can request a booking any time — even at midnight.

## How it works

1. Enable the page and choose which services can be booked.
2. Share the link on your website, Google profile, invoices and quotes.
3. Incoming requests arrive as drafts for you to confirm — nothing is ever booked without your say-so.

## Public directory listing

You can also appear in the EveryJob public directory so nearby customers can find you. Listings are consent-only: nothing is published about your business unless you explicitly turn it on.`,
    },
    fr: {
      title: 'Votre page de réservation en ligne',
      body: `## Laissez les clients vous réserver directement

Activez votre page de réservation publique dans Paramètres → Réservation. Vous obtenez un lien à partager (la page /book de votre entreprise) où les clients peuvent demander une réservation en tout temps — même à minuit.

## Comment ça fonctionne

1. Activez la page et choisissez les services réservables.
2. Partagez le lien sur votre site web, votre fiche Google, vos factures et soumissions.
3. Les demandes arrivent comme brouillons à confirmer — rien n'est jamais réservé sans votre accord.

## Fiche publique au répertoire

Vous pouvez aussi paraître dans le répertoire public EveryJob pour que les clients proches vous trouvent. Les fiches sont sur consentement : rien n'est publié sur votre entreprise sans votre activation explicite.`,
    },
  },
  {
    id: 'credentials',
    slug: 'credentials',
    category: 'profile',
    related: ['getting-started', 'copilot'],
    en: {
      title: 'Credentials, designations and your trade profile',
      body: `## Showcase your licences

In Settings → Credentials, add your trade licences, certifications, insurance and bonding: title, issuing body, licence number, issue and expiry dates. They appear on your public directory listing and build customer trust.

## Your trade profile

Set your primary trade (plumbing, electrical, HVAC, carpentry, painting, landscaping, cleaning, renovation…), your province, years in business and specialties. Your trade and province power everything tailored in the app.

## Certification roadmap

Based on your trade, EveryJob shows a roadmap of real Canadian credentials you can pursue next — Red Seal, provincial bodies like Skilled Trades Ontario or SkilledTradesBC, and official links. No invented programs, ever.

## Profile strength

Insights scores your profile out of 100 from your own data and lists the next steps to strengthen it: add a logo, set working hours, add services to your price book, earn more credentials.`,
    },
    fr: {
      title: 'Titres de compétence et profil de métier',
      body: `## Mettez vos permis en valeur

Dans Paramètres → Titres, ajoutez vos permis de métier, certifications, assurances et cautionnements : titre, organisme émetteur, numéro, dates de délivrance et d'expiration. Ils apparaissent sur votre fiche publique et inspirent confiance aux clients.

## Votre profil de métier

Définissez votre métier principal (plomberie, électricité, CVCA, menuiserie, peinture, aménagement paysager, nettoyage, rénovation…), votre province, vos années d'activité et vos spécialités. Votre métier et votre province alimentent tout ce qui est personnalisé dans l'application.

## Feuille de route de certification

Selon votre métier, EveryJob affiche une feuille de route de vrais titres canadiens à envisager — Sceau rouge, organismes provinciaux comme Skilled Trades Ontario ou SkilledTradesBC, avec liens officiels. Jamais de programmes inventés.

## Solidité du profil

Aperçus note votre profil sur 100 à partir de vos propres données et liste les prochaines étapes pour le renforcer : ajoutez un logo, définissez vos heures, ajoutez des services à votre catalogue, obtenez plus de titres.`,
    },
  },
  {
    id: 'getting-help',
    slug: 'getting-help',
    category: 'help',
    related: ['copilot', 'getting-started'],
    en: {
      title: 'Getting help: help center, AI, and direct support',
      body: `## Three ways to get unstuck

1. **This help center** — searchable articles written from the app's real features, in English and French.
2. **The AI assistant** — instant answers about your own data and how to use the app (bottom-right of every page).
3. **A support ticket** — use the form below. Your ticket goes **directly to the owner of EveryJob** — no ticket black hole, no tiered support queues, no bots stalling you.

## What to include in a ticket

Your name, your email, a short subject, and what happened: what you were trying to do, what you expected, and what you saw instead. Screenshots help if you can describe them.

## Response expectations

EveryJob is run by its founder. Tickets are read by a human — usually the person who built the feature you're asking about.`,
    },
    fr: {
      title: 'Obtenir de l’aide : centre d’aide, IA et soutien direct',
      body: `## Trois façons de vous débloquer

1. **Ce centre d'aide** — des articles consultables décrivant les vraies fonctions de l'application, en français et en anglais.
2. **L'assistant IA** — des réponses instantanées sur vos propres données et sur l'utilisation de l'application (en bas à droite de chaque page).
3. **Un billet de soutien** — utilisez le formulaire ci-dessous. Votre billet va **directement au propriétaire d'EveryJob** — pas de trou noir, pas de files d'attente par niveaux, pas de robots qui vous font patienter.

## Quoi inclure dans un billet

Votre nom, votre courriel, un objet court, et ce qui s'est passé : ce que vous essayiez de faire, ce à quoi vous vous attendiez, et ce que vous avez vu à la place. Des captures d'écran aident si vous pouvez les décrire.

## À quoi vous attendre

EveryJob est géré par son fondateur. Les billets sont lus par un humain — généralement la personne qui a conçu la fonction sur laquelle vous posez une question.`,
    },
  },
];

const BY_SLUG = new Map(A.map((a) => [a.slug, a]));

/** All articles, in display order. */
export function listArticles(): HelpArticle[] {
  return A;
}

/** Find an article by slug. */
export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return BY_SLUG.get(slug);
}

/** Articles in a category, in display order. */
export function articlesInCategory(category: HelpCategoryId): HelpArticle[] {
  return A.filter((a) => a.category === category);
}

/** Case-insensitive search over titles and bodies in the given locale. */
export function searchArticles(query: string, locale: 'en' | 'fr'): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return A;
  return A.filter((a) => {
    const loc = locale === 'fr' ? a.fr : a.en;
    return (
      loc.title.toLowerCase().includes(q) || loc.body.toLowerCase().includes(q)
    );
  });
}

/** Category label in the given locale. */
export function categoryLabel(id: HelpCategoryId, locale: 'en' | 'fr'): string {
  return HELP_CATEGORIES.find((c) => c.id === id)?.[locale] ?? id;
}
