'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bell,
  Calendar,
  CalendarCheck,
  Check,
  Clock,
  FileText,
  House,
  Inbox,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Sun,
  Users,
  Wrench,
  Zap,
} from '@/components/icons';
import {
  applyTheme,
  getSavedTheme,
  type ThemeChoice,
} from '@/components/ThemePicker';
import {
  AgendaRow,
  Avatar,
  Banner,
  BottomSheet,
  Card,
  ChatBubble,
  ContactButtons,
  CopilotActionCard,
  EmptyState,
  FilterChips,
  KeyValueRow,
  LeadCard,
  LineItems,
  ListRow,
  MarginBar,
  PageHeader,
  PaymentMethodChoices,
  PhotoTiles,
  PortalHeader,
  ProgressSteps,
  ProjectCard,
  SearchField,
  SegmentedControl,
  Skeleton,
  StatusBadge,
  StickyActionBar,
  SummaryCard,
  TabBar,
  Toast,
  TopBar,
  WeekStrip,
} from './index';
import type {
  FilterChip,
  PaymentMethodOption,
  PortalLang,
  ProgressStep,
  SegmentedOption,
  StatusBadgeTone,
  TabBarTab,
  WeekStripDay,
} from './index';
import { kitButtonClass } from './kit-button';

type Lang = 'en' | 'fr';

const noop = () => {};

interface ShowcaseStrings {
  pageTitle: string;
  pageSub: string;
  themeLabel: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  secNav: string;
  secStructure: string;
  secFinding: string;
  secLists: string;
  secCards: string;
  secActions: string;
  secScreens: string;
  secCustomer: string;
  dTopbarBrand: string;
  dTopbarBack: string;
  dTabbar: string;
  dPageheader: string;
  dSearch: string;
  dChips: string;
  dSeg: string;
  dListrow: string;
  dBadge: string;
  dCard: string;
  dBanner: string;
  dKv: string;
  dContact: string;
  dSteps: string;
  dLines: string;
  dPhotos: string;
  dMargin: string;
  dSummary: string;
  dAvatar: string;
  dSticky: string;
  dSheet: string;
  dToast: string;
  dEmpty: string;
  dSkeleton: string;
  dWeek: string;
  dAgenda: string;
  dLead: string;
  dProject: string;
  dChat: string;
  dCopilot: string;
  dPortal: string;
  dPay: string;
  topbar: { brand: string; back: string; search: string; notif: string; call: string };
  tab: {
    aria: string;
    today: string;
    jobs: string;
    schedule: string;
    customers: string;
    invoices: string;
  };
  pageheader: { title: string; summary: string; action: string };
  search: { placeholder: string; label: string; clear: string };
  chips: { aria: string; all: string; active: string; overdue: string; archived: string };
  seg: { aria: string; day: string; week: string; month: string };
  list: {
    r1title: string;
    r1sub: string;
    r1amount: string;
    r1cap: string;
    r2title: string;
    r2sub: string;
    r2amount: string;
    r2cap: string;
    r3title: string;
    r3sub: string;
    r3badge: string;
    r3amount: string;
    r3cap: string;
  };
  badges: Record<StatusBadgeTone, string>;
  card: { title: string; text: string; action: string };
  banner: {
    warnTitle: string;
    warnText: string;
    warnAction: string;
    infoTitle: string;
    infoText: string;
  };
  kv: {
    addr: string;
    addrSub: string;
    change: string;
    window: string;
    windowSub: string;
    confirmed: string;
  };
  contact: { call: string; text: string; email: string; map: string };
  steps: { s1: string; s1sub: string; s2: string; s2sub: string; s3: string };
  lines: {
    l1t: string;
    l1d: string;
    l2t: string;
    l2d: string;
    subtotal: string;
    tax: string;
    total: string;
    paid: string;
  };
  photos: { add: string; before: string; after: string };
  margin: { profit: string; marginLbl: string; cost: string; bar: string };
  summary: {
    today: string;
    todaySub: string;
    revenue: string;
    revenueSub: string;
    overdue: string;
    overdueSub: string;
  };
  avatar: { md: string; lg: string };
  sticky: { total: string; primary: string; secondary: string; primaryOnly: string };
  sheet: { title: string; sub: string; body: string; footNote: string };
  toast: { msg: string; undo: string };
  empty: { title: string; text: string; action: string };
  skeleton: { row: string; card: string; list: string };
  week: WeekStripDay[];
  agenda: {
    a1title: string;
    a1sub: string;
    a1who: string;
    a1chip: string;
    a2title: string;
    a2sub: string;
    a2who: string;
    a2chip: string;
    a3title: string;
    a3sub: string;
    a3who: string;
    a3chip: string;
  };
  lead: {
    name: string;
    source: string;
    waiting: string;
    msg: string;
    tags: string[];
    quote: string;
    call: string;
    decline: string;
  };
  project: {
    title: string;
    sub: string;
    phase: string;
    contract: string;
    invoiced: string;
    next: string;
    nextVal: string;
  };
  chat: { me: string; ai: string; s1: string; s2: string };
  copilot: { title: string; text: string; primary: string; secondary: string };
  portal: { name: string; area: string };
  pay: {
    recommended: string;
    card: string;
    cardSub: string;
    etransfer: string;
    etransferSub: string;
    cash: string;
    cashSub: string;
  };
}

const EN: ShowcaseStrings = {
  pageTitle: 'UI kit showcase',
  pageSub: 'Every kit component, in every state.',
  themeLabel: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  secNav: 'Navigation',
  secStructure: 'Page structure',
  secFinding: 'Finding things',
  secLists: 'Lists',
  secCards: 'Cards & content',
  secActions: 'Actions & feedback',
  secScreens: 'Screen-specific',
  secCustomer: 'Customer-facing',
  dTopbarBrand: 'TopBar — brand variant',
  dTopbarBack: 'TopBar — back variant',
  dTabbar: 'TabBar',
  dPageheader: 'PageHeader',
  dSearch: 'SearchField',
  dChips: 'FilterChips',
  dSeg: 'SegmentedControl',
  dListrow: 'ListRow',
  dBadge: 'StatusBadge',
  dCard: 'Card',
  dBanner: 'Banner',
  dKv: 'KeyValueRow',
  dContact: 'ContactButtons',
  dSteps: 'ProgressSteps',
  dLines: 'LineItems',
  dPhotos: 'PhotoTiles',
  dMargin: 'MarginBar',
  dSummary: 'SummaryCard',
  dAvatar: 'Avatar',
  dSticky: 'StickyActionBar',
  dSheet: 'BottomSheet — open',
  dToast: 'Toast — visible',
  dEmpty: 'EmptyState',
  dSkeleton: 'Skeleton',
  dWeek: 'WeekStrip',
  dAgenda: 'AgendaRow',
  dLead: 'LeadCard',
  dProject: 'ProjectCard',
  dChat: 'ChatBubble',
  dCopilot: 'CopilotActionCard',
  dPortal: 'PortalHeader',
  dPay: 'PaymentMethodChoices',
  topbar: {
    brand: 'EveryJob',
    back: 'Customers',
    search: 'Search',
    notif: 'Notifications',
    call: 'Call',
  },
  tab: {
    aria: 'Main navigation',
    today: 'Today',
    jobs: 'Jobs',
    schedule: 'Schedule',
    customers: 'Customers',
    invoices: 'Invoices',
  },
  pageheader: {
    title: 'Customers',
    summary: '24 customers on file',
    action: 'Add customer',
  },
  search: {
    placeholder: 'Search customers',
    label: 'Search customers',
    clear: 'Clear search',
  },
  chips: {
    aria: 'Filter customers',
    all: 'All',
    active: 'Active',
    overdue: 'Overdue',
    archived: 'Archived',
  },
  seg: { aria: 'View range', day: 'Day', week: 'Week', month: 'Month' },
  list: {
    r1title: 'Furnace repair',
    r1sub: '123 Main St',
    r1amount: '$240.00',
    r1cap: 'Due today',
    r2title: 'Alice Bouchard',
    r2sub: 'alice@example.com',
    r2amount: '$85.50',
    r2cap: 'Balance',
    r3title: 'Invoice #1042',
    r3sub: 'Sent 3 days ago',
    r3badge: 'Overdue',
    r3amount: '$512.75',
    r3cap: 'Unpaid',
  },
  badges: {
    late: 'Late',
    warn: 'Due soon',
    done: 'Paid',
    scheduled: 'Scheduled',
    info: 'Sent',
    neutral: 'Draft',
  },
  card: {
    title: 'Panel title',
    text: 'Cards group related content on a single surface.',
    action: 'Try it',
  },
  banner: {
    warnTitle: 'Action needed',
    warnText: '3 invoices are overdue. Review them before Friday.',
    warnAction: 'Review',
    infoTitle: 'Sync complete',
    infoText: 'All data is up to date.',
  },
  kv: {
    addr: 'Service address',
    addrSub: '456 Oak Ave, Toronto',
    change: 'Change',
    window: 'Arrival window',
    windowSub: '9:00 AM – 11:00 AM',
    confirmed: 'Confirmed',
  },
  contact: { call: 'Call', text: 'Text', email: 'Email', map: 'Map' },
  steps: {
    s1: 'Booked',
    s1sub: 'Oct 12',
    s2: 'In progress',
    s2sub: 'Started 9:15 AM',
    s3: 'Review',
  },
  lines: {
    l1t: 'Labour — 2 h',
    l1d: 'Furnace repair',
    l2t: 'Thermostat',
    l2d: 'Part #T-200',
    subtotal: 'Subtotal',
    tax: 'GST (5%)',
    total: 'Total',
    paid: 'Paid',
  },
  photos: { add: 'Add', before: 'Before', after: 'After' },
  margin: {
    profit: 'Profit',
    marginLbl: 'margin',
    cost: 'Cost $215.00 · Price $371.00',
    bar: 'Profit margin bar',
  },
  summary: {
    today: 'Today',
    todaySub: 'jobs scheduled',
    revenue: 'Revenue',
    revenueSub: 'this week',
    overdue: 'Overdue',
    overdueSub: 'need follow-up',
  },
  avatar: { md: 'Medium', lg: 'Large' },
  sticky: {
    total: 'Total',
    primary: 'Send invoice',
    secondary: 'Save draft',
    primaryOnly: 'Continue',
  },
  sheet: {
    title: 'Choose a date',
    sub: 'Pick the visit day for this job.',
    body: 'This sheet is rendered open to show its layout: grab handle, title, content and footer.',
    footNote: 'Custom footer content goes here.',
  },
  toast: { msg: 'Invoice sent to Alice Bouchard.', undo: 'Undo' },
  empty: {
    title: 'No customers yet',
    text: 'Add your first customer to start scheduling jobs.',
    action: 'Add customer',
  },
  skeleton: { row: 'Row', card: 'Card', list: 'List' },
  week: [
    { key: 'd12', dow: 'M', dayNum: 12, label: 'Monday, October 12', visitCount: 0, isToday: false },
    { key: 'd13', dow: 'T', dayNum: 13, label: 'Tuesday, October 13', visitCount: 2, isToday: false },
    { key: 'd14', dow: 'W', dayNum: 14, label: 'Wednesday, October 14', visitCount: 1, isToday: false },
    { key: 'd15', dow: 'T', dayNum: 15, label: 'Thursday, October 15', visitCount: 4, isToday: false },
    { key: 'd16', dow: 'F', dayNum: 16, label: 'Friday, October 16', visitCount: 0, isToday: false },
    { key: 'd17', dow: 'S', dayNum: 17, label: 'Saturday, October 17', visitCount: 3, isToday: true },
    { key: 'd18', dow: 'S', dayNum: 18, label: 'Sunday, October 18', visitCount: 0, isToday: false },
  ],
  agenda: {
    a1title: 'Furnace repair',
    a1sub: 'Alice Bouchard · 123 Main St',
    a1who: 'Marc',
    a1chip: 'Done',
    a2title: 'Panel upgrade',
    a2sub: 'Jean Côté · 789 Pine Rd',
    a2who: 'Léa',
    a2chip: 'Now',
    a3title: 'Quote visit',
    a3sub: 'Noah Roy · 321 Elm St',
    a3who: 'Marc',
    a3chip: 'Scheduled',
  },
  lead: {
    name: 'Sophie Lapointe',
    source: 'Website',
    waiting: 'Waiting 2 h',
    msg: 'Hi, my water heater is leaking. Can someone come this week?',
    tags: ['Water heater', 'Urgent'],
    quote: 'Quote',
    call: 'Call',
    decline: 'Decline',
  },
  project: {
    title: 'Bathroom renovation',
    sub: 'Alice Bouchard · 3 visits',
    phase: 'Rough-in',
    contract: 'Contract',
    invoiced: 'Invoiced',
    next: 'Next',
    nextVal: 'Tile starts Oct 22',
  },
  chat: {
    me: "What's my schedule tomorrow?",
    ai: 'You have 3 visits tomorrow, starting at 9:00 AM.',
    s1: 'Schedule',
    s2: 'Jobs',
  },
  copilot: {
    title: 'Draft quote ready',
    text: 'A draft quote for Alice Bouchard is ready to review.',
    primary: 'Review draft',
    secondary: 'Dismiss',
  },
  portal: { name: 'Atelier Nord', area: 'Serving Montréal' },
  pay: {
    recommended: 'Recommended',
    card: 'Credit card',
    cardSub: 'Visa ···· 4242',
    etransfer: 'Interac e-Transfer',
    etransferSub: 'To billing@example.com',
    cash: 'Cash',
    cashSub: 'Pay on site',
  },
};

const FR: ShowcaseStrings = {
  pageTitle: "Vitrine du kit d'interface",
  pageSub: 'Tous les composants du kit, dans tous leurs états.',
  themeLabel: 'Thème',
  themeSystem: 'Système',
  themeLight: 'Clair',
  themeDark: 'Sombre',
  secNav: 'Navigation',
  secStructure: 'Structure de page',
  secFinding: 'Recherche et filtres',
  secLists: 'Listes',
  secCards: 'Cartes et contenu',
  secActions: 'Actions et rétroaction',
  secScreens: 'Par écran',
  secCustomer: 'Côté client',
  dTopbarBrand: 'TopBar — variante marque',
  dTopbarBack: 'TopBar — variante retour',
  dTabbar: 'TabBar',
  dPageheader: 'PageHeader',
  dSearch: 'SearchField',
  dChips: 'FilterChips',
  dSeg: 'SegmentedControl',
  dListrow: 'ListRow',
  dBadge: 'StatusBadge',
  dCard: 'Card',
  dBanner: 'Banner',
  dKv: 'KeyValueRow',
  dContact: 'ContactButtons',
  dSteps: 'ProgressSteps',
  dLines: 'LineItems',
  dPhotos: 'PhotoTiles',
  dMargin: 'MarginBar',
  dSummary: 'SummaryCard',
  dAvatar: 'Avatar',
  dSticky: 'StickyActionBar',
  dSheet: 'BottomSheet — ouverte',
  dToast: 'Toast — visible',
  dEmpty: 'EmptyState',
  dSkeleton: 'Skeleton',
  dWeek: 'WeekStrip',
  dAgenda: 'AgendaRow',
  dLead: 'LeadCard',
  dProject: 'ProjectCard',
  dChat: 'ChatBubble',
  dCopilot: 'CopilotActionCard',
  dPortal: 'PortalHeader',
  dPay: 'PaymentMethodChoices',
  topbar: {
    brand: 'EveryJob',
    back: 'Clients',
    search: 'Rechercher',
    notif: 'Notifications',
    call: 'Appeler',
  },
  tab: {
    aria: 'Navigation principale',
    today: "Aujourd'hui",
    jobs: 'Tâches',
    schedule: 'Horaire',
    customers: 'Clients',
    invoices: 'Factures',
  },
  pageheader: {
    title: 'Clients',
    summary: '24 clients au dossier',
    action: 'Ajouter un client',
  },
  search: {
    placeholder: 'Rechercher des clients',
    label: 'Rechercher des clients',
    clear: 'Effacer la recherche',
  },
  chips: {
    aria: 'Filtrer les clients',
    all: 'Tous',
    active: 'Actifs',
    overdue: 'En retard',
    archived: 'Archivés',
  },
  seg: { aria: 'Période affichée', day: 'Jour', week: 'Semaine', month: 'Mois' },
  list: {
    r1title: 'Réparation de fournaise',
    r1sub: '123, rue Principale',
    r1amount: '240,00 $',
    r1cap: "Dû aujourd'hui",
    r2title: 'Alice Bouchard',
    r2sub: 'alice@exemple.com',
    r2amount: '85,50 $',
    r2cap: 'Solde',
    r3title: 'Facture n° 1042',
    r3sub: 'Envoyée il y a 3 jours',
    r3badge: 'En retard',
    r3amount: '512,75 $',
    r3cap: 'Impayée',
  },
  badges: {
    late: 'En retard',
    warn: 'Bientôt dû',
    done: 'Payé',
    scheduled: 'Planifié',
    info: 'Envoyée',
    neutral: 'Brouillon',
  },
  card: {
    title: 'Titre du panneau',
    text: 'Les cartes regroupent le contenu lié sur une même surface.',
    action: 'Essayer',
  },
  banner: {
    warnTitle: 'Action requise',
    warnText: '3 factures sont en retard. Vérifiez-les avant vendredi.',
    warnAction: 'Vérifier',
    infoTitle: 'Synchronisation terminée',
    infoText: 'Toutes les données sont à jour.',
  },
  kv: {
    addr: 'Adresse de service',
    addrSub: '456, av. Oak, Toronto',
    change: 'Modifier',
    window: "Plage d'arrivée",
    windowSub: '9 h à 11 h',
    confirmed: 'Confirmé',
  },
  contact: { call: 'Appeler', text: 'Texto', email: 'Courriel', map: 'Carte' },
  steps: {
    s1: 'Réservé',
    s1sub: '12 oct.',
    s2: 'En cours',
    s2sub: 'Commencé à 9 h 15',
    s3: 'Révision',
  },
  lines: {
    l1t: 'Main-d’œuvre — 2 h',
    l1d: 'Réparation de fournaise',
    l2t: 'Thermostat',
    l2d: 'Pièce n° T-200',
    subtotal: 'Sous-total',
    tax: 'TPS (5 %)',
    total: 'Total',
    paid: 'Payé',
  },
  photos: { add: 'Ajouter', before: 'Avant', after: 'Après' },
  margin: {
    profit: 'Profit',
    marginLbl: 'marge',
    cost: 'Coût 215,00 $ · Prix 371,00 $',
    bar: 'Barre de marge bénéficiaire',
  },
  summary: {
    today: "Aujourd'hui",
    todaySub: 'tâches planifiées',
    revenue: 'Revenu',
    revenueSub: 'cette semaine',
    overdue: 'En retard',
    overdueSub: 'à relancer',
  },
  avatar: { md: 'Moyen', lg: 'Grand' },
  sticky: {
    total: 'Total',
    primary: 'Envoyer la facture',
    secondary: 'Enregistrer le brouillon',
    primaryOnly: 'Continuer',
  },
  sheet: {
    title: 'Choisir une date',
    sub: 'Choisissez le jour de la visite pour cette tâche.',
    body: 'Cette feuille est affichée ouverte pour montrer sa mise en page : poignée, titre, contenu et pied de page.',
    footNote: 'Le contenu personnalisé du pied de page va ici.',
  },
  toast: { msg: 'Facture envoyée à Alice Bouchard.', undo: 'Annuler' },
  empty: {
    title: 'Aucun client pour le moment',
    text: 'Ajoutez votre premier client pour commencer à planifier des tâches.',
    action: 'Ajouter un client',
  },
  skeleton: { row: 'Ligne', card: 'Carte', list: 'Liste' },
  week: [
    { key: 'd12', dow: 'L', dayNum: 12, label: 'lundi 12 octobre', visitCount: 0, isToday: false },
    { key: 'd13', dow: 'M', dayNum: 13, label: 'mardi 13 octobre', visitCount: 2, isToday: false },
    { key: 'd14', dow: 'M', dayNum: 14, label: 'mercredi 14 octobre', visitCount: 1, isToday: false },
    { key: 'd15', dow: 'J', dayNum: 15, label: 'jeudi 15 octobre', visitCount: 4, isToday: false },
    { key: 'd16', dow: 'V', dayNum: 16, label: 'vendredi 16 octobre', visitCount: 0, isToday: false },
    { key: 'd17', dow: 'S', dayNum: 17, label: 'samedi 17 octobre', visitCount: 3, isToday: true },
    { key: 'd18', dow: 'D', dayNum: 18, label: 'dimanche 18 octobre', visitCount: 0, isToday: false },
  ],
  agenda: {
    a1title: 'Réparation de fournaise',
    a1sub: 'Alice Bouchard · 123, rue Principale',
    a1who: 'Marc',
    a1chip: 'Terminée',
    a2title: 'Mise à niveau du panneau',
    a2sub: 'Jean Côté · 789, ch. Pine',
    a2who: 'Léa',
    a2chip: 'En cours',
    a3title: "Visite d'estimation",
    a3sub: 'Noah Roy · 321, rue Elm',
    a3who: 'Marc',
    a3chip: 'Planifiée',
  },
  lead: {
    name: 'Sophie Lapointe',
    source: 'Site web',
    waiting: 'Attente : 2 h',
    msg: 'Bonjour, mon chauffe-eau fuit. Quelqu’un peut-il passer cette semaine ?',
    tags: ['Chauffe-eau', 'Urgent'],
    quote: 'Soumission',
    call: 'Appeler',
    decline: 'Refuser',
  },
  project: {
    title: 'Rénovation de salle de bain',
    sub: 'Alice Bouchard · 3 visites',
    phase: 'Plomberie brute',
    contract: 'Contrat',
    invoiced: 'Facturé',
    next: 'Prochain',
    nextVal: 'Carrelage dès le 22 oct.',
  },
  chat: {
    me: 'Quel est mon horaire demain ?',
    ai: 'Vous avez 3 visites demain, dès 9 h 00.',
    s1: 'Horaire',
    s2: 'Tâches',
  },
  copilot: {
    title: 'Soumission prête',
    text: 'Une soumission pour Alice Bouchard est prête à vérifier.',
    primary: 'Vérifier',
    secondary: 'Ignorer',
  },
  portal: { name: 'Atelier Nord', area: 'Dessert Montréal' },
  pay: {
    recommended: 'Recommandé',
    card: 'Carte de crédit',
    cardSub: 'Visa ···· 4242',
    etransfer: 'Virement Interac',
    etransferSub: 'À billing@exemple.com',
    cash: 'Comptant',
    cashSub: 'Payé sur place',
  },
};

const STR: Record<Lang, ShowcaseStrings> = { en: EN, fr: FR };

const BADGE_TONES: StatusBadgeTone[] = [
  'late',
  'warn',
  'done',
  'scheduled',
  'info',
  'neutral',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[21px] font-bold tracking-tight text-ink">{title}</h2>
      <div className="mt-4 grid gap-5">{children}</div>
    </section>
  );
}

function Demo({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[15px] font-bold text-ink-2">{name}</h3>
      {children}
    </div>
  );
}

/**
 * Internal UI-kit showcase for /design: every kit component in every
 * meaningful state, with all copy supplied as props (EN/FR tables above).
 * The dark-mode CI test walks this page's [data-kit] elements.
 */
export function Showcase({ lang }: { lang: Lang }) {
  const t = STR[lang];

  // Theme: default respects the saved choice (never forced).
  const [theme, setTheme] = useState<ThemeChoice>(getSavedTheme);
  const pickTheme = (id: string) => {
    const choice = id as ThemeChoice;
    setTheme(choice);
    applyTheme(choice);
  };

  const [query, setQuery] = useState('furn');
  const [chip, setChip] = useState('active');
  const [range, setRange] = useState('week');
  const [weekDay, setWeekDay] = useState('d17');
  const [payMethod, setPayMethod] = useState('card');
  const [portalLang, setPortalLang] = useState<PortalLang>(lang);

  // BottomSheet is rendered open as a static demo. It locks body scroll and
  // steals focus on open; restore page usability afterwards.
  useEffect(() => {
    document.body.style.overflow = '';
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
  }, []);

  const tabs: TabBarTab[] = [
    { id: 'today', label: t.tab.today, icon: Sun, href: '#today' },
    { id: 'jobs', label: t.tab.jobs, icon: Wrench, href: '#jobs', badge: 2 },
    { id: 'schedule', label: t.tab.schedule, icon: Calendar, href: '#schedule' },
    { id: 'customers', label: t.tab.customers, icon: Users, href: '#customers' },
    { id: 'invoices', label: t.tab.invoices, icon: FileText, href: '#invoices' },
  ];

  const chips: FilterChip[] = [
    { id: 'all', label: t.chips.all, count: 24 },
    { id: 'active', label: t.chips.active, count: 18 },
    { id: 'overdue', label: t.chips.overdue, count: 3, tone: 'danger' },
    { id: 'archived', label: t.chips.archived, count: 6 },
  ];

  const segOptions: SegmentedOption[] = [
    { id: 'day', label: t.seg.day },
    { id: 'week', label: t.seg.week },
    { id: 'month', label: t.seg.month },
  ];

  const steps: ProgressStep[] = [
    { label: t.steps.s1, sub: t.steps.s1sub, state: 'done' },
    { label: t.steps.s2, sub: t.steps.s2sub, state: 'now' },
    { label: t.steps.s3, state: 'todo' },
  ];

  const payMethods: PaymentMethodOption[] = [
    { id: 'card', title: t.pay.card, sub: t.pay.cardSub, recommended: true },
    { id: 'etransfer', title: t.pay.etransfer, sub: t.pay.etransferSub },
    { id: 'cash', title: t.pay.cash, sub: t.pay.cashSub },
  ];

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-24 pt-6">
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight">
          {t.pageTitle}
        </h1>
        <p className="mt-1 text-[16px] text-ink-2">{t.pageSub}</p>

        <div className="mt-4">
          <SegmentedControl
            options={[
              { id: 'system', label: t.themeSystem },
              { id: 'light', label: t.themeLight },
              { id: 'dark', label: t.themeDark },
            ]}
            selectedId={theme}
            onSelect={pickTheme}
            ariaLabel={t.themeLabel}
          />
        </div>

        <Section title={t.secNav}>
          <Demo name={t.dTopbarBrand}>
            <TopBar
              variant="brand"
              brandName={t.topbar.brand}
              actions={[
                { icon: Search, label: t.topbar.search, onClick: noop },
                { icon: Bell, label: t.topbar.notif, badge: 3, onClick: noop },
              ]}
            />
          </Demo>
          <Demo name={t.dTopbarBack}>
            <TopBar
              variant="back"
              backLabel={t.topbar.back}
              onBack={noop}
              actions={[{ icon: Phone, label: t.topbar.call, onClick: noop }]}
            />
          </Demo>
          <Demo name={t.dTabbar}>
            {/* Static in-flow so the demo page stays usable. */}
            <div className="[&_[data-kit=tab-bar]]:static">
              <TabBar tabs={tabs} activeId="jobs" ariaLabel={t.tab.aria} />
            </div>
          </Demo>
        </Section>

        <Section title={t.secStructure}>
          <Demo name={t.dPageheader}>
            <PageHeader
              title={t.pageheader.title}
              summary={t.pageheader.summary}
              actionLabel={t.pageheader.action}
              actionHref="#add"
            />
          </Demo>
        </Section>

        <Section title={t.secFinding}>
          <Demo name={t.dSearch}>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={t.search.placeholder}
              label={t.search.label}
              clearLabel={t.search.clear}
            />
          </Demo>
          <Demo name={t.dChips}>
            <div className="-mx-4">
              <FilterChips
                chips={chips}
                selectedId={chip}
                onSelect={setChip}
                ariaLabel={t.chips.aria}
              />
            </div>
          </Demo>
          <Demo name={t.dSeg}>
            <SegmentedControl
              options={segOptions}
              selectedId={range}
              onSelect={setRange}
              ariaLabel={t.seg.aria}
            />
          </Demo>
        </Section>

        <Section title={t.secLists}>
          <Demo name={t.dListrow}>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <ListRow
                icon={Wrench}
                title={t.list.r1title}
                subtitle={t.list.r1sub}
                amount={t.list.r1amount}
                amountCaption={t.list.r1cap}
                amountTone="warn"
                onClick={noop}
              />
              <ListRow
                avatarInitials="AB"
                title={t.list.r2title}
                subtitle={t.list.r2sub}
                amount={t.list.r2amount}
                amountCaption={t.list.r2cap}
                onClick={noop}
              />
              <ListRow
                icon={FileText}
                title={t.list.r3title}
                subtitle={t.list.r3sub}
                meta={<StatusBadge tone="late">{t.list.r3badge}</StatusBadge>}
                amount={t.list.r3amount}
                amountCaption={t.list.r3cap}
                amountTone="bad"
                onClick={noop}
              />
            </div>
          </Demo>
          <Demo name={t.dBadge}>
            <div className="flex flex-wrap gap-2">
              {BADGE_TONES.map((tone) => (
                <StatusBadge
                  key={tone}
                  tone={tone}
                  icon={tone === 'done' ? Check : undefined}
                >
                  {t.badges[tone]}
                </StatusBadge>
              ))}
            </div>
          </Demo>
        </Section>

        <Section title={t.secCards}>
          <Demo name={t.dCard}>
            <Card className="p-4">
              <h4 className="text-[17px] font-bold text-ink">{t.card.title}</h4>
              <p className="mt-1 text-[15px] text-ink-2">{t.card.text}</p>
              <button
                type="button"
                className={kitButtonClass('primary', { sm: true }) + ' mt-3'}
                onClick={noop}
              >
                {t.card.action}
              </button>
            </Card>
          </Demo>
          <Demo name={t.dBanner}>
            <div className="grid gap-2">
              <Banner
                tone="warn"
                title={t.banner.warnTitle}
                text={t.banner.warnText}
                actionLabel={t.banner.warnAction}
                onAction={noop}
              />
              <Banner
                tone="info"
                title={t.banner.infoTitle}
                text={t.banner.infoText}
              />
            </div>
          </Demo>
          <Demo name={t.dKv}>
            <Card className="px-4 py-1">
              <KeyValueRow
                icon={MapPin}
                label={t.kv.addr}
                sub={t.kv.addrSub}
                action={
                  <button
                    type="button"
                    className={kitButtonClass('secondary', { sm: true })}
                    onClick={noop}
                  >
                    {t.kv.change}
                  </button>
                }
              />
              <KeyValueRow
                icon={Clock}
                label={t.kv.window}
                sub={t.kv.windowSub}
                action={
                  <StatusBadge tone="scheduled">{t.kv.confirmed}</StatusBadge>
                }
              />
            </Card>
          </Demo>
          <Demo name={t.dContact}>
            <Card className="p-3">
              <ContactButtons
                labels={{
                  call: t.contact.call,
                  text: t.contact.text,
                  email: t.contact.email,
                  map: t.contact.map,
                }}
                onCall={noop}
                onText={noop}
                onEmail={noop}
                onMap={noop}
              />
            </Card>
          </Demo>
          <Demo name={t.dSteps}>
            <ProgressSteps steps={steps} />
          </Demo>
          <Demo name={t.dLines}>
            <LineItems
              lines={[
                { title: t.lines.l1t, detail: t.lines.l1d, amountCents: 18000 },
                { title: t.lines.l2t, detail: t.lines.l2d, amountCents: 8999 },
              ]}
              subtotalLabel={t.lines.subtotal}
              subtotalCents={26999}
              taxLabel={t.lines.tax}
              taxCents={1350}
              totalLabel={t.lines.total}
              totalCents={28349}
              paidLabel={t.lines.paid}
              paidCents={10000}
            />
          </Demo>
          <Demo name={t.dPhotos}>
            <PhotoTiles
              photos={[{ label: t.photos.before }, { label: t.photos.after }]}
              addLabel={t.photos.add}
              onAdd={noop}
            />
          </Demo>
          <Demo name={t.dMargin}>
            <MarginBar
              profitLabel={t.margin.profit}
              profitCents={15600}
              marginPct={42}
              marginLabel={t.margin.marginLbl}
              costLabel={t.margin.cost}
              barLabel={t.margin.bar}
            />
          </Demo>
          <Demo name={t.dSummary}>
            <div className="grid gap-2">
              <SummaryCard
                stats={[
                  { label: t.summary.today, value: '5', sub: t.summary.todaySub },
                  {
                    label: t.summary.revenue,
                    value: lang === 'fr' ? '1 240 $' : '$1,240',
                    sub: t.summary.revenueSub,
                  },
                ]}
              />
              <SummaryCard
                stats={[
                  { label: t.summary.today, value: '5', sub: t.summary.todaySub },
                  {
                    label: t.summary.revenue,
                    value: lang === 'fr' ? '1 240 $' : '$1,240',
                    sub: t.summary.revenueSub,
                  },
                  {
                    label: t.summary.overdue,
                    value: '3',
                    sub: t.summary.overdueSub,
                  },
                ]}
              />
            </div>
          </Demo>
          <Demo name={t.dAvatar}>
            <div className="flex items-end gap-6">
              <span className="flex flex-col items-center gap-1.5">
                <Avatar initials="AB" size="md" />
                <span className="text-[13px] font-semibold text-ink-2">
                  {t.avatar.md}
                </span>
              </span>
              <span className="flex flex-col items-center gap-1.5">
                <Avatar initials="CD" size="lg" />
                <span className="text-[13px] font-semibold text-ink-2">
                  {t.avatar.lg}
                </span>
              </span>
            </div>
          </Demo>
        </Section>

        <Section title={t.secActions}>
          <Demo name={t.dSticky}>
            <div className="grid gap-4">
              {/* Rendered statically in-flow (not fixed) so the page stays usable. */}
              <div className="[&_[data-kit=sticky-action-bar]]:static">
                <StickyActionBar
                  totalLabel={t.sticky.total}
                  totalCents={37100}
                  primaryLabel={t.sticky.primary}
                  onPrimary={noop}
                  secondaryLabel={t.sticky.secondary}
                  onSecondary={noop}
                />
              </div>
              <div className="[&_[data-kit=sticky-action-bar]]:static">
                <StickyActionBar
                  primaryLabel={t.sticky.primaryOnly}
                  onPrimary={noop}
                />
              </div>
            </div>
          </Demo>
          <Demo name={t.dSheet}>
            {/* The fixed sheet is contained to this stage via a transform, so
                the open state renders in-flow without covering the page. */}
            <div className="relative min-h-[430px] overflow-hidden rounded-2xl border border-line bg-surface-2 [transform:translateZ(0)]">
              <BottomSheet
                open
                onClose={noop}
                title={t.sheet.title}
                sub={t.sheet.sub}
                footer={
                  <p className="mt-4 text-[14px] text-ink-2">
                    {t.sheet.footNote}
                  </p>
                }
              >
                <p className="text-[15px] text-ink-2">{t.sheet.body}</p>
              </BottomSheet>
            </div>
          </Demo>
          <Demo name={t.dToast}>
            {/* Fixed toast contained to this stage via a transform. */}
            <div className="relative h-[200px] overflow-hidden rounded-2xl border border-line bg-surface-2 [transform:translateZ(0)]">
              <Toast
                message={t.toast.msg}
                actionLabel={t.toast.undo}
                onAction={noop}
                visible
              />
            </div>
          </Demo>
          <Demo name={t.dEmpty}>
            <Card className="py-2">
              <EmptyState
                icon={Inbox}
                title={t.empty.title}
                text={t.empty.text}
                actionLabel={t.empty.action}
                onAction={noop}
              />
            </Card>
          </Demo>
          <Demo name={t.dSkeleton}>
            <div className="grid gap-3">
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-ink-2">
                  {t.skeleton.row}
                </p>
                <Skeleton variant="row" />
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-ink-2">
                  {t.skeleton.card}
                </p>
                <Skeleton variant="card" />
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-ink-2">
                  {t.skeleton.list}
                </p>
                <Skeleton variant="list" />
              </div>
            </div>
          </Demo>
        </Section>

        <Section title={t.secScreens}>
          <Demo name={t.dWeek}>
            <WeekStrip
              days={t.week}
              selectedKey={weekDay}
              onSelect={setWeekDay}
            />
          </Demo>
          <Demo name={t.dAgenda}>
            <div className="grid gap-2">
              <AgendaRow
                time="9:00"
                ampm="AM"
                tone="done"
                icon={Wrench}
                title={t.agenda.a1title}
                sub={t.agenda.a1sub}
                who={t.agenda.a1who}
                whoInitials="MG"
                statusChip={
                  <StatusBadge tone="done">{t.agenda.a1chip}</StatusBadge>
                }
                onClick={noop}
              />
              <AgendaRow
                time="10:30"
                ampm="AM"
                tone="open"
                icon={Zap}
                title={t.agenda.a2title}
                sub={t.agenda.a2sub}
                who={t.agenda.a2who}
                whoInitials="LR"
                statusChip={
                  <StatusBadge tone="warn">{t.agenda.a2chip}</StatusBadge>
                }
                onClick={noop}
              />
              <AgendaRow
                time="1:00"
                ampm="PM"
                tone="scheduled"
                icon={CalendarCheck}
                title={t.agenda.a3title}
                sub={t.agenda.a3sub}
                who={t.agenda.a3who}
                whoInitials="MG"
                statusChip={
                  <StatusBadge tone="scheduled">{t.agenda.a3chip}</StatusBadge>
                }
                onClick={noop}
              />
            </div>
          </Demo>
          <Demo name={t.dLead}>
            <LeadCard
              initials="SL"
              name={t.lead.name}
              source={t.lead.source}
              waitingLabel={t.lead.waiting}
              message={t.lead.msg}
              tags={t.lead.tags}
              quoteLabel={t.lead.quote}
              callLabel={t.lead.call}
              declineLabel={t.lead.decline}
              onQuote={noop}
              onCall={noop}
              onDecline={noop}
            />
          </Demo>
          <Demo name={t.dProject}>
            <ProjectCard
              icon={House}
              title={t.project.title}
              sub={t.project.sub}
              progressPct={65}
              phaseLabel={t.project.phase}
              contractCents={1200000}
              invoicedCents={780000}
              nextLabel={t.project.nextVal}
              metaLabels={{
                contract: t.project.contract,
                invoiced: t.project.invoiced,
                next: t.project.next,
              }}
            />
          </Demo>
          <Demo name={t.dChat}>
            <div className="flex flex-col gap-2">
              <ChatBubble from="me">{t.chat.me}</ChatBubble>
              <ChatBubble from="ai" sources={[t.chat.s1, t.chat.s2]}>
                {t.chat.ai}
              </ChatBubble>
            </div>
          </Demo>
          <Demo name={t.dCopilot}>
            <CopilotActionCard
              icon={Sparkles}
              title={t.copilot.title}
              text={t.copilot.text}
              primaryLabel={t.copilot.primary}
              onPrimary={noop}
              secondaryLabel={t.copilot.secondary}
              onSecondary={noop}
            />
          </Demo>
        </Section>

        <Section title={t.secCustomer}>
          <Demo name={t.dPortal}>
            <PortalHeader
              businessInitial="A"
              businessName={t.portal.name}
              areaLabel={t.portal.area}
              lang={portalLang}
              onLangChange={setPortalLang}
            />
          </Demo>
          <Demo name={t.dPay}>
            <PaymentMethodChoices
              methods={payMethods}
              selectedId={payMethod}
              onSelect={setPayMethod}
              recommendedLabel={t.pay.recommended}
            />
          </Demo>
        </Section>
      </div>
    </main>
  );
}
