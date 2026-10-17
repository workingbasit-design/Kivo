/**
 * Trade icons for job types (Part B, dashboard rebuild).
 *
 * Each price-book service maps to one trade icon. The owner can override the
 * automatic mapping per service (Service.iconKey). The icons render from the
 * single Phosphor family (see src/components/icons.tsx) - never inside
 * coloured tiles.
 */

export const TRADE_KEYS = [
  'cleaning',
  'gutters',
  'furnace',
  'windows',
  'plumbing',
  'electrical',
  'landscaping',
  'snow',
  'painting',
  'general',
] as const;

export type TradeKey = (typeof TRADE_KEYS)[number];

/** Phosphor icon component names (from src/components/icons) per trade. */
export const TRADE_ICON_COMPONENTS: Record<TradeKey, string> = {
  cleaning: 'Broom',
  gutters: 'Drop',
  furnace: 'Flame',
  windows: 'AppWindow',
  plumbing: 'Wrench',
  electrical: 'Lightning',
  landscaping: 'Tree',
  snow: 'Snowflake',
  painting: 'PaintRoller',
  general: 'Hammer',
};

/** Keywords (EN + FR) used to auto-detect a service's trade from its name. */
const TRADE_KEYWORDS: Record<TradeKey, string[]> = {
  cleaning: ['clean', 'nettoyage', 'ménage', 'maid', 'janitorial', 'deep clean'],
  gutters: ['gutter', 'gouttière', 'gouttiere', 'downspout', 'eavestrough'],
  furnace: ['furnace', 'hvac', 'chauffage', 'fournaise', 'tune-up', 'tune up', 'climatisation', 'air condition'],
  windows: ['window', 'fenêtre', 'fenetre', 'vitre', 'glass'],
  plumbing: ['plumb', 'plomberie', 'drain', 'pipe', 'toilet', 'faucet', 'robinet', 'water heater', 'chauffe-eau'],
  electrical: ['electric', 'électri', 'electri', 'wiring', 'outlet', 'panel', 'luminaire', 'lighting'],
  landscaping: ['landscap', 'aménagement', 'amenagement', 'lawn', 'pelouse', 'garden', 'jardin', 'yard', 'tree', 'arbre'],
  snow: ['snow', 'neige', 'déneigement', 'deneigement', 'shovel'],
  painting: ['paint', 'peinture', 'drywall', 'plâtre', 'platre'],
  general: ['handyman', 'homme à tout faire', 'repair', 'réparation', 'reparation', 'maintenance', 'install'],
};

export function isTradeKey(v: unknown): v is TradeKey {
  return typeof v === 'string' && (TRADE_KEYS as readonly string[]).includes(v);
}

/**
 * Detection order: specific trades before generic ones. "Gutter cleaning"
 * contains "clean", so gutters must be tested before cleaning.
 */
const DETECTION_ORDER: TradeKey[] = [
  'gutters',
  'furnace',
  'windows',
  'plumbing',
  'electrical',
  'landscaping',
  'snow',
  'painting',
  'cleaning',
];

/**
 * Resolve a service's trade icon key: the owner's explicit choice wins,
 * otherwise keyword matching on the service name (EN/FR), falling back to
 * 'general' (handyman).
 */
export function tradeKeyForService(service: {
  name: string;
  nameFr?: string | null;
  category?: string | null;
  iconKey?: string | null;
}): TradeKey {
  if (isTradeKey(service.iconKey)) return service.iconKey;
  const hay = `${service.name ?? ''} ${service.nameFr ?? ''} ${service.category ?? ''}`.toLowerCase();
  for (const key of DETECTION_ORDER) {
    if (TRADE_KEYWORDS[key].some((kw) => hay.includes(kw))) return key;
  }
  return 'general';
}
