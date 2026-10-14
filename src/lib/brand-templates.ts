/**
 * Brand-kit social templates: pure copy-paste post templates for the business.
 * No DB, no network - safe to unit test. Locale-aware (EN + Canadian FR).
 */

export type BrandLocale = 'en' | 'fr';

export interface BrandInfo {
  name: string;
  tagline: string | null;
  services: string[];
  phone: string | null;
}

export interface SocialTemplate {
  /** Stable id: announcement | seasonal | review | referral */
  id: string;
  title: string;
  body: string;
}

const MAX_SERVICES_IN_TEMPLATE = 3;

function serviceLine(services: string[], locale: BrandLocale): string {
  const shown = services.slice(0, MAX_SERVICES_IN_TEMPLATE);
  if (shown.length === 0) return '';
  if (locale === 'fr') {
    return `\nNos services : ${shown.join(', ')}.`;
  }
  return `\nOur services: ${shown.join(', ')}.`;
}

function taglineLine(tagline: string | null): string {
  return tagline ? `\n${tagline}` : '';
}

function phoneLine(phone: string | null, locale: BrandLocale): string {
  if (!phone) return '';
  return locale === 'fr' ? `\nAppelez-nous : ${phone}` : `\nCall us: ${phone}`;
}

/**
 * Build 4 copy-paste social templates (EN or FR).
 * Never throws on partial input - missing fields are simply omitted.
 */
export function buildSocialTemplates(
  brand: BrandInfo,
  locale: BrandLocale = 'en'
): SocialTemplate[] {
  const name = brand.name?.trim() || (locale === 'fr' ? 'Notre entreprise' : 'Our business');
  const services = (brand.services ?? []).map((s) => s.trim()).filter(Boolean);
  const phone = brand.phone?.trim() || null;
  const tag = taglineLine(brand.tagline?.trim() || null);
  const svc = serviceLine(services, locale);
  const tel = phoneLine(phone, locale);

  if (locale === 'fr') {
    return [
      {
        id: 'announcement',
        title: 'Annonce de service',
        body:
          `🎉 Nouveau service chez ${name} !${tag}${svc}${tel}` +
          `\nÉcrivez-nous pour un devis gratuit - on vous répond vite !`,
      },
      {
        id: 'seasonal',
        title: 'Rappel saisonnier',
        body:
          `🍂 La saison change - pensez à l'entretien avec ${name} !${tag}${svc}${tel}` +
          `\nRéservez votre visite dès aujourd'hui.`,
      },
      {
        id: 'review',
        title: 'Demande d’avis',
        body:
          `⭐ Vous avez aimé notre travail ? Un petit avis Google aide ${name} énormément !${tag}` +
          `\nMerci de soutenir une entreprise locale. 🙏${tel}`,
      },
      {
        id: 'referral',
        title: 'Parrainage',
        body:
          `🤝 Connaissez quelqu’un qui a besoin d’un pro de confiance ? Recommandez ${name} !${tag}${svc}${tel}` +
          `\nVos recommandations sont notre meilleure publicité. Merci !`,
      },
    ];
  }

  return [
    {
      id: 'announcement',
      title: 'New-service announcement',
      body:
        `🎉 New service from ${name}!${tag}${svc}${tel}` +
        `\nMessage us for a free quote - we reply fast!`,
    },
    {
      id: 'seasonal',
      title: 'Seasonal reminder',
      body:
        `🍂 Season change - time for maintenance with ${name}!${tag}${svc}${tel}` +
        `\nBook your visit today.`,
    },
    {
      id: 'review',
      title: 'Review ask',
      body:
        `⭐ Enjoyed our work? A quick Google review helps ${name} a ton!${tag}` +
        `\nThanks for supporting a local business. 🙏${tel}`,
    },
    {
      id: 'referral',
      title: 'Referral ask',
      body:
        `🤝 Know someone who needs a trusted pro? Refer ${name}!${tag}${svc}${tel}` +
        `\nYour referrals are our best advertising. Thank you!`,
    },
  ];
}

/** Safe-parse the JSON brand fields; never throws. */
export function parseBrandColors(
  raw: string | null
): { primary: string; accent: string } {
  const fallback = { primary: '#3f6212', accent: '#a3e635' };
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as Partial<{ primary: string; accent: string }>;
    const hex = (s: unknown, d: string) =>
      typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s) ? s : d;
    return { primary: hex(v?.primary, fallback.primary), accent: hex(v?.accent, fallback.accent) };
  } catch {
    return fallback;
  }
}

export function parseBrandServices(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}
