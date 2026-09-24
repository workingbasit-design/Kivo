/**
 * Certification roadmap for Canadian home-service businesses.
 *
 * HARD RULE: every program listed here must verifiably exist, with a link to
 * its official body. When in doubt, the program is left out. Nothing here is
 * scraped, invented, or presented as data about other businesses — these are
 * public credential programs a business owner can pursue.
 */

export type TradeKey =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'carpentry'
  | 'painting'
  | 'landscaping'
  | 'cleaning'
  | 'renovation'
  | 'other';

export const TRADE_KEYS: TradeKey[] = [
  'plumbing',
  'electrical',
  'hvac',
  'carpentry',
  'painting',
  'landscaping',
  'cleaning',
  'renovation',
  'other',
];

export interface Certification {
  id: string;
  /** Language-neutral official name */
  name: string;
  issuer: string;
  url: string;
  why: { en: string; fr: string };
}

/** Provincial apprenticeship / trade-certification bodies (official). */
const PROVINCIAL_BODIES: Record<string, { name: string; url: string }> = {
  ON: { name: 'Skilled Trades Ontario', url: 'https://www.skilledtradesontario.ca' },
  BC: { name: 'SkilledTradesBC', url: 'https://www.skilledtradesbc.ca' },
  AB: {
    name: 'Alberta Apprenticeship and Industry Training',
    url: 'https://tradesecrets.alberta.ca',
  },
  SK: {
    name: 'Saskatchewan Apprenticeship and Trade Certification Commission',
    url: 'https://saskapprenticeship.ca',
  },
  NS: { name: 'Nova Scotia Apprenticeship Agency', url: 'https://nsapprenticeship.ca' },
  QC: { name: 'Commission de la construction du Québec (CCQ)', url: 'https://www.ccq.org' },
};

const RED_SEAL: Certification = {
  id: 'red-seal',
  name: 'Red Seal Endorsement',
  issuer: 'Red Seal Program (Employment and Social Development Canada)',
  url: 'https://www.red-seal.ca',
  why: {
    en: 'The national standard of excellence for skilled trades. A Red Seal on your trade certificate is recognized in every province and territory — customers know what it means.',
    fr: 'La norme nationale d’excellence pour les métiers spécialisés. Le Sceau rouge est reconnu dans chaque province et territoire — les clients savent ce que cela signifie.',
  },
};

/** Red Seal trade names per our trade keys (only trades that actually have a Red Seal). */
const RED_SEAL_TRADES: Partial<Record<TradeKey, string>> = {
  plumbing: 'Plumber',
  electrical: 'Construction Electrician',
  hvac: 'Refrigeration and Air Conditioning Mechanic',
  carpentry: 'Carpenter',
  painting: 'Painter and Decorator',
  landscaping: 'Landscape Horticulturist',
  renovation: 'Carpenter',
};

const BBB: Certification = {
  id: 'bbb',
  name: 'BBB Accreditation',
  issuer: 'Better Business Bureau',
  url: 'https://www.bbb.org',
  why: {
    en: 'The trust signal most Canadian homeowners check before hiring. Accredited businesses can display the BBB seal on quotes and their EveryJob booking page.',
    fr: 'Le signal de confiance que la plupart des propriétaires canadiens vérifient avant d’embaucher. Les entreprises accréditées peuvent afficher le sceau BBB sur leurs devis et leur page de réservation.',
  },
};

const PROVINCIAL_FALLBACK: Certification = {
  id: 'provincial-body',
  name: 'Provincial apprenticeship authority',
  issuer: 'Via the Red Seal jurisdictional directory',
  url: 'https://www.red-seal.ca',
  why: {
    en: 'Every province and territory runs its own apprenticeship and trade-certification office. Find yours through the official Red Seal directory to start certification in your trade.',
    fr: 'Chaque province et territoire a son propre bureau d’apprentissage et de certification. Trouvez le vôtre dans le répertoire officiel du Sceau rouge pour entamer votre certification.',
  },
};

function provincialCert(province: string | null | undefined): Certification {
  const body = province ? PROVINCIAL_BODIES[province.toUpperCase()] : undefined;
  if (!body) return PROVINCIAL_FALLBACK;
  return {
    id: `provincial-${province!.toLowerCase()}`,
    name: `${body.name} — trade certification`,
    issuer: body.name,
    url: body.url,
    why: {
      en: `Your province's official route to a Certificate of Qualification in your trade — the licence customers ask about first.`,
      fr: `La voie officielle de votre province vers un certificat de qualification dans votre métier — le permis que les clients demandent en premier.`,
    },
  };
}

const TRADE_EXTRAS: Partial<Record<TradeKey, (province: string | null | undefined) => Certification[]>> = {
  plumbing: (province) =>
    province === 'QC'
      ? [
          {
            id: 'cmmtq',
            name: 'CMMTQ membership',
            issuer: 'Corporation des maîtres mécaniciens en tuyauterie du Québec',
            url: 'https://www.cmmtq.org',
            why: {
              en: 'Quebec’s corporation for plumbing and heating contractors. Membership signals licensed, accountable work to Quebec customers.',
              fr: 'La corporation des entrepreneurs en plomberie et chauffage du Québec. L’adhésion témoigne d’un travail autorisé et responsable aux yeux des clients québécois.',
            },
          },
        ]
      : [],
  electrical: (province) =>
    province === 'ON'
      ? [
          {
            id: 'esa-contractor',
            name: 'Licensed Electrical Contractor (ECRA)',
            issuer: 'Electrical Safety Authority (ESA)',
            url: 'https://www.esasafe.com',
            why: {
              en: 'In Ontario, only ESA-licensed contractors may legally do electrical work for hire. The licence number belongs on every quote.',
              fr: 'En Ontario, seuls les entrepreneurs titulaires d’un permis de l’Office de la sécurité des installations électriques peuvent légalement effectuer des travaux électriques rémunérés. Le numéro de permis doit figurer sur chaque devis.',
            },
          },
        ]
      : [],
  hvac: () => [
    {
      id: 'hrai',
      name: 'HRAI membership / certification',
      issuer: 'Heating, Refrigeration and Air Conditioning Institute of Canada',
      url: 'https://www.hrai.ca',
      why: {
        en: 'Canada’s HVAC industry association. HRAI training and certification (including residential heat-loss/heat-gain design) is the credential heating customers recognize.',
        fr: 'L’association canadienne de l’industrie du CVCA. La formation et la certification HRAI (dont le calcul des charges thermiques résidentielles) sont le titre de compétence reconnu par les clients en chauffage.',
      },
    },
  ],
  renovation: (province) =>
    province === 'QC'
      ? [
          {
            id: 'rbq',
            name: 'RBQ licence',
            issuer: 'Régie du bâtiment du Québec',
            url: 'https://www.rbq.gouv.qc.ca',
            why: {
              en: 'Required by law to do construction work in Quebec. Your RBQ licence number must appear on contracts and advertising.',
              fr: 'Exigée par la loi pour exécuter des travaux de construction au Québec. Votre numéro de licence RBQ doit figurer sur les contrats et la publicité.',
            },
          },
        ]
      : [
          {
            id: 'chba',
            name: 'CHBA membership',
            issuer: 'Canadian Home Builders’ Association',
            url: 'https://www.chba.ca',
            why: {
              en: 'Canada’s national association for renovators and home builders. Membership and RenoMark-style credentials reassure renovation customers.',
              fr: 'L’association nationale canadienne des rénovateurs et constructeurs. L’adhésion et les titres de type RenoMark rassurent les clients en rénovation.',
            },
          },
        ],
};

/**
 * Ordered roadmap of REAL credentials for a trade + province.
 * Pure function — no DB, fully testable.
 */
export function getCertificationRoadmap(
  trade: TradeKey | string | null | undefined,
  province: string | null | undefined
): Certification[] {
  const t = (trade ?? 'other') as TradeKey;
  const out: Certification[] = [];

  const redSealTrade = RED_SEAL_TRADES[t];
  if (redSealTrade) {
    out.push({
      ...RED_SEAL,
      name: `Red Seal Endorsement — ${redSealTrade}`,
    });
  }
  out.push(provincialCert(province));
  out.push(...(TRADE_EXTRAS[t]?.(province) ?? []));
  out.push(BBB);
  return out;
}
