/**
 * Legal page content (EN + Canadian French) for Privacy Policy, Terms of
 * Service, and Copyright/DMCA takedown policy.
 *
 * Plain-language summaries, not legal advice. EveryJob is a Canadian
 * product; the privacy policy follows PIPEDA principles.
 */

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalPage {
  title: string;
  updated: string;
  intro: string[];
  sections: LegalSection[];
}

export const PRIVACY: { en: LegalPage; fr: LegalPage } = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: September 2026',
    intro: [
      'EveryJob ("we", "our") helps Canadian home-service businesses run their work in one place. This policy explains what information we collect, why, and what choices you have. We follow Canada\u2019s PIPEDA principles: we collect only what we need, use it only for the service you signed up for, and never sell your personal information.',
    ],
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Account information: your name, email address, business name, and contact number — the details you give us when you sign up.',
          'Business data you enter: customers, jobs, quotes, invoices, payments, schedules, and files you upload. This is your data; we store it so the app works.',
          'Technical data: device type, browser, and basic usage logs we need for security (rate limiting, abuse prevention) and to fix bugs.',
          'Location: only when you or your team explicitly share it for an active job (for example, a live tracking link you create). Location pings are deleted automatically after 24 hours.',
        ],
      },
      {
        heading: 'What we don\u2019t do',
        body: [
          'We do not sell your personal information — to anyone, ever.',
          'We do not run advertising trackers, session-replay recorders, or third-party analytics on your workspace.',
          'Fonts are served from our own servers; your visit never phones home to a font provider.',
        ],
      },
      {
        heading: 'How we use your information',
        body: [
          'To run your workspace: storing and showing your business data back to you.',
          'To send transactional emails you asked for: account setup, password resets, quotes, and invoices.',
          'To keep the service safe: detecting abuse, preventing spam, and fixing errors.',
          'We never use your data for marketing without your explicit consent.',
        ],
      },
      {
        heading: 'Your rights (PIPEDA)',
        body: [
          'Access: ask us what personal information we hold about you and we\u2019ll provide it.',
          'Correction: fix anything inaccurate in your account from Settings, or ask us.',
          'Deletion: close your account and we delete your personal data, subject to tax and legal record-keeping we\u2019re required to keep.',
          'To exercise any of these, contact us from the Help center in the app.',
        ],
      },
      {
        heading: 'Data retention',
        body: [
          'We keep your business data while your account is active. Location pings are deleted after 24 hours. If you close your account, we delete your personal information within 30 days, except records we must keep for legal or tax reasons.',
        ],
      },
      {
        heading: 'Children',
        body: [
          'EveryJob is a business tool for adults. You must be 18 or older to create an account. We do not knowingly collect information from anyone under 18.',
        ],
      },
    ],
  },
  fr: {
    title: 'Politique de confidentialité',
    updated: 'Dernière mise à jour : septembre 2026',
    intro: [
      'EveryJob (« nous ») aide les entreprises canadiennes de services à domicile à gérer leur travail au même endroit. Cette politique explique quelles informations nous recueillons, pourquoi, et quels choix s\u2019offrent à vous. Nous suivons les principes de la LPRPDE : nous ne recueillons que le nécessaire, nous l\u2019utilisons uniquement pour le service auquel vous vous êtes inscrit, et nous ne vendons jamais vos renseignements personnels.',
    ],
    sections: [
      {
        heading: 'Ce que nous recueillons',
        body: [
          'Informations du compte : votre nom, votre courriel, le nom de votre entreprise et votre numéro de téléphone — les détails que vous nous donnez à l\u2019inscription.',
          'Données d\u2019entreprise que vous saisissez : clients, travaux, devis, factures, paiements, horaires et fichiers téléversés. Ce sont vos données; nous les stockons pour faire fonctionner l\u2019application.',
          'Données techniques : type d\u2019appareil, navigateur et journaux d\u2019utilisation de base nécessaires à la sécurité (limitation du débit, prévention des abus) et à la correction des bogues.',
          'Localisation : uniquement lorsque vous ou votre équipe la partagez explicitement pour un travail actif (par exemple, un lien de suivi que vous créez). Les positions sont supprimées automatiquement après 24 heures.',
        ],
      },
      {
        heading: 'Ce que nous ne faisons pas',
        body: [
          'Nous ne vendons jamais vos renseignements personnels — à personne.',
          'Nous n\u2019utilisons aucun traqueur publicitaire, enregistreur de session ni outil d\u2019analyse tiers dans votre espace de travail.',
          'Les polices sont servies depuis nos propres serveurs; votre visite ne contacte jamais un fournisseur de polices.',
        ],
      },
      {
        heading: 'Comment nous utilisons vos informations',
        body: [
          'Pour faire fonctionner votre espace : stocker vos données d\u2019entreprise et vous les présenter.',
          'Pour envoyer les courriels transactionnels demandés : création de compte, réinitialisation de mot de passe, devis et factures.',
          'Pour garder le service sécuritaire : détection des abus, prévention du pourriel et correction des erreurs.',
          'Nous n\u2019utilisons jamais vos données à des fins de marketing sans votre consentement explicite.',
        ],
      },
      {
        heading: 'Vos droits (LPRPDE)',
        body: [
          'Accès : demandez-nous quels renseignements personnels nous détenons à votre sujet et nous vous les fournirons.',
          'Correction : corrigez toute inexactitude depuis les Réglages, ou demandez-nous.',
          'Suppression : fermez votre compte et nous supprimerons vos renseignements personnels, sous réserve des dossiers fiscaux et légaux que nous devons conserver.',
          'Pour exercer ces droits, contactez-nous depuis le centre d\u2019aide dans l\u2019application.',
        ],
      },
      {
        heading: 'Conservation des données',
        body: [
          'Nous conservons vos données d\u2019entreprise tant que votre compte est actif. Les positions sont supprimées après 24 heures. Si vous fermez votre compte, nous supprimons vos renseignements personnels dans les 30 jours, sauf les dossiers que nous devons conserver pour des raisons légales ou fiscales.',
        ],
      },
      {
        heading: 'Enfants',
        body: [
          'EveryJob est un outil d\u2019entreprise pour adultes. Vous devez avoir 18 ans ou plus pour créer un compte. Nous ne recueillons sciemment aucune information de personnes de moins de 18 ans.',
        ],
      },
    ],
  },
};

export const TERMS: { en: LegalPage; fr: LegalPage } = {
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: September 2026',
    intro: [
      'These terms govern your use of EveryJob. By creating an account, you agree to them. If you don\u2019t agree, don\u2019t use the service.',
    ],
    sections: [
      {
        heading: 'Who can use EveryJob',
        body: [
          'You must be 18 or older and able to enter into a contract. EveryJob is built for Canadian home-service businesses; you\u2019re responsible for making sure your use complies with the laws where you operate.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'You\u2019re responsible for keeping your password confidential and for everything done under your account.',
          'One account per business workspace. Don\u2019t share logins outside your team.',
          'Tell us right away if you suspect unauthorized access.',
        ],
      },
      {
        heading: 'Your data',
        body: [
          'You own the business data you put into EveryJob — your customers, jobs, quotes, and invoices are yours.',
          'You give us permission to store and process that data only to run the service for you.',
          'Don\u2019t upload anything illegal, infringing, or that you don\u2019t have the right to store.',
        ],
      },
      {
        heading: 'Acceptable use',
        body: [
          'Don\u2019t abuse the service: no spam, no scraping, no attempts to break into other workspaces, no uploading malware.',
          'Don\u2019t use EveryJob to harass anyone or to send messages people didn\u2019t ask for.',
          'We may suspend accounts that abuse the service or put other users at risk.',
        ],
      },
      {
        heading: 'Free service',
        body: [
          'EveryJob is currently free. We may introduce paid plans in the future; if we do, we\u2019ll tell you well in advance and never charge you without your explicit agreement.',
        ],
      },
      {
        heading: 'Availability',
        body: [
          'We work hard to keep EveryJob running, but we can\u2019t promise 100% uptime. We may pause the service for maintenance and will try to give notice when we can.',
        ],
      },
      {
        heading: 'Limitation of liability',
        body: [
          'To the maximum extent allowed by law, EveryJob is provided "as is". We\u2019re not liable for indirect or consequential losses — for example, lost profits from a missed job. Our total liability is limited to the amounts you paid us in the 12 months before the claim (currently $0 on the free plan).',
        ],
      },
      {
        heading: 'Changes',
        body: [
          'We may update these terms as the product evolves. We\u2019ll post the new version here with a new date; continued use after that means you accept the changes.',
        ],
      },
    ],
  },
  fr: {
    title: 'Conditions d\u2019utilisation',
    updated: 'Dernière mise à jour : septembre 2026',
    intro: [
      'Ces conditions régissent votre utilisation d\u2019EveryJob. En créant un compte, vous les acceptez. Si vous n\u2019êtes pas d\u2019accord, n\u2019utilisez pas le service.',
    ],
    sections: [
      {
        heading: 'Qui peut utiliser EveryJob',
        body: [
          'Vous devez avoir 18 ans ou plus et être apte à conclure un contrat. EveryJob est conçu pour les entreprises canadiennes de services à domicile; il vous incombe de vous assurer que votre utilisation respecte les lois en vigueur là où vous opérez.',
        ],
      },
      {
        heading: 'Votre compte',
        body: [
          'Vous êtes responsable de la confidentialité de votre mot de passe et de tout ce qui est fait sous votre compte.',
          'Un compte par espace d\u2019entreprise. Ne partagez pas vos identifiants hors de votre équipe.',
          'Prévenez-nous immédiatement si vous soupçonnez un accès non autorisé.',
        ],
      },
      {
        heading: 'Vos données',
        body: [
          'Les données d\u2019entreprise que vous entrez dans EveryJob vous appartiennent — vos clients, travaux, devis et factures sont à vous.',
          'Vous nous autorisez à stocker et traiter ces données uniquement pour faire fonctionner le service pour vous.',
          'Ne téléversez rien d\u2019illégal, de contrefait, ni rien que vous n\u2019avez pas le droit de stocker.',
        ],
      },
      {
        heading: 'Utilisation acceptable',
        body: [
          'N\u2019abusez pas du service : pas de pourriel, pas d\u2019extraction automatisée, pas de tentative d\u2019accès aux espaces d\u2019autrui, pas de logiciels malveillants.',
          'N\u2019utilisez pas EveryJob pour harceler qui que ce soit ni pour envoyer des messages non sollicités.',
          'Nous pouvons suspendre les comptes qui abusent du service ou mettent d\u2019autres utilisateurs en danger.',
        ],
      },
      {
        heading: 'Service gratuit',
        body: [
          'EveryJob est actuellement gratuit. Nous pourrions proposer des forfaits payants à l\u2019avenir; le cas échéant, nous vous préviendrons bien à l\u2019avance et ne vous facturerons jamais sans votre accord explicite.',
        ],
      },
      {
        heading: 'Disponibilité',
        body: [
          'Nous travaillons fort pour garder EveryJob en ligne, mais nous ne pouvons garantir une disponibilité de 100 %. Nous pouvons interrompre le service pour maintenance et tenterons de vous prévenir lorsque c\u2019est possible.',
        ],
      },
      {
        heading: 'Limitation de responsabilité',
        body: [
          'Dans toute la mesure permise par la loi, EveryJob est fourni « tel quel ». Nous ne sommes pas responsables des pertes indirectes — par exemple, des profits perdus à cause d\u2019un travail manqué. Notre responsabilité totale est limitée aux montants que vous nous avez versés dans les 12 mois précédant la réclamation (actuellement 0 $ sur le forfait gratuit).',
        ],
      },
      {
        heading: 'Modifications',
        body: [
          'Nous pouvons mettre à jour ces conditions à mesure que le produit évolue. Nous publierons la nouvelle version ici avec une nouvelle date; continuer à utiliser le service signifie que vous acceptez les modifications.',
        ],
      },
    ],
  },
};

export const COPYRIGHT: { en: LegalPage; fr: LegalPage } = {
  en: {
    title: 'Copyright & Takedown Policy',
    updated: 'Last updated: September 2026',
    intro: [
      'EveryJob respects intellectual property. If you believe content uploaded by a user infringes your copyright, tell us and we\u2019ll act quickly. This page explains how to file a notice, what happens next, and how to dispute a removal.',
    ],
    sections: [
      {
        heading: 'Filing a takedown notice',
        body: [
          'Send your notice from the Help center in the app, or by email, with all of the following:',
          '1. Your name and contact information (email and phone).',
          '2. Identification of the copyrighted work you own (a link or description).',
          '3. The exact location of the infringing material in EveryJob (URL or a precise description of where to find it).',
          '4. A statement that you have a good-faith belief the use is not authorized by you, your agent, or the law.',
          '5. A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act for the owner.',
          '6. Your physical or electronic signature.',
        ],
      },
      {
        heading: 'What happens after you file',
        body: [
          'We review every complete notice, usually within 2 business days.',
          'If the notice is valid, we remove or disable access to the material and notify the user who uploaded it.',
          'Repeat infringers lose their accounts.',
        ],
      },
      {
        heading: 'Counter-notice',
        body: [
          'If your content was removed and you believe that was a mistake, you can file a counter-notice with your contact details, identification of the removed material, and a consent to jurisdiction statement. We\u2019ll forward it to the original complainant; if they don\u2019t take legal action within 10–14 business days, we may restore the material.',
        ],
      },
      {
        heading: 'Abuse of the process',
        body: [
          'Filing false notices is against the law and against our Terms. Accounts that file fraudulent takedowns will be suspended.',
        ],
      },
      {
        heading: 'Designated agent',
        body: [
          'Our designated copyright agent is the EveryJob support team, reachable from the Help center in the app. (US safe-harbor registration with the Copyright Office is in progress.)',
        ],
      },
    ],
  },
  fr: {
    title: 'Politique sur le droit d\u2019auteur et les retraits',
    updated: 'Dernière mise à jour : septembre 2026',
    intro: [
      'EveryJob respecte la propriété intellectuelle. Si vous croyez qu\u2019un contenu téléversé par un utilisateur viole votre droit d\u2019auteur, dites-le-nous et nous agirons rapidement. Cette page explique comment déposer un avis, ce qui se passe ensuite et comment contester un retrait.',
    ],
    sections: [
      {
        heading: 'Déposer un avis de retrait',
        body: [
          'Envoyez votre avis depuis le centre d\u2019aide dans l\u2019application, ou par courriel, avec tous les éléments suivants :',
          '1. Votre nom et vos coordonnées (courriel et téléphone).',
          '2. L\u2019identification de l\u2019œuvre protégée dont vous êtes titulaire (lien ou description).',
          '3. L\u2019emplacement exact du contenu litigieux dans EveryJob (URL ou description précise).',
          '4. Une déclaration selon laquelle vous croyez de bonne foi que l\u2019utilisation n\u2019est pas autorisée par vous, votre mandataire ou la loi.',
          '5. Une déclaration, sous peine de parjure, que les renseignements de votre avis sont exacts et que vous êtes le titulaire du droit d\u2019auteur ou autorisé à agir pour lui.',
          '6. Votre signature physique ou électronique.',
        ],
      },
      {
        heading: 'Ce qui se passe après votre avis',
        body: [
          'Nous examinons chaque avis complet, généralement dans un délai de 2 jours ouvrables.',
          'Si l\u2019avis est valide, nous retirons le contenu ou en bloquons l\u2019accès, et nous avisons l\u2019utilisateur qui l\u2019a téléversé.',
          'Les récidivistes perdent leur compte.',
        ],
      },
      {
        heading: 'Contre-avis',
        body: [
          'Si votre contenu a été retiré et que vous croyez qu\u2019il s\u2019agit d\u2019une erreur, vous pouvez déposer un contre-avis avec vos coordonnées, l\u2019identification du contenu retiré et une déclaration de consentement à la juridiction. Nous le transmettrons au plaignant initial; s\u2019il n\u2019intente pas de poursuite dans les 10 à 14 jours ouvrables, nous pourrons restaurer le contenu.',
        ],
      },
      {
        heading: 'Abus de la procédure',
        body: [
          'Déposer de faux avis est illégal et contraire à nos Conditions. Les comptes qui déposent des retraits frauduleux seront suspendus.',
        ],
      },
      {
        heading: 'Agent désigné',
        body: [
          'Notre agent désigné pour le droit d\u2019auteur est l\u2019équipe de soutien EveryJob, joignable depuis le centre d\u2019aide dans l\u2019application. (L\u2019enregistrement américain auprès du Bureau du droit d\u2019auteur est en cours.)',
        ],
      },
    ],
  },
};
