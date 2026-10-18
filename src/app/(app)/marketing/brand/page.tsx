import { Palette } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { Card } from '@/components/kit';
import { BrandKitForm } from '@/components/BrandKitForm';
import CopyButton from '@/components/CopyButton';
import { PageTitle } from '../../_components/PageTitle';
import {
  buildSocialTemplates,
  parseBrandColors,
  parseBrandServices,
} from '@/lib/brand-templates';

export const metadata = { title: 'Brand kit | EveryJob' };

function BrandHeaderPreview({
  name,
  tagline,
  logoUrl,
  primary,
  accent,
  locale,
}: {
  name: string;
  tagline: string;
  logoUrl: string | null;
  primary: string;
  accent: string;
  locale: Locale;
}) {
  return (
    <div className="rounded-2xl border border-line overflow-hidden bg-surface">
      <div className="h-2.5" style={{ backgroundColor: accent }} aria-hidden />
      <div className="p-5 flex items-center gap-4">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="w-14 h-14 rounded-xl object-cover border border-line"
          />
        ) : (
          <span
            className="w-14 h-14 rounded-xl flex items-center justify-center text-hero-ink font-bold text-xl"
            style={{ backgroundColor: primary }}
            aria-hidden
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-lg font-bold truncate" style={{ color: primary }}>
            {name}
          </p>
          {tagline && (
            <p className="text-sm text-ink-2 truncate">{tagline}</p>
          )}
          <p className="text-xs text-ink-2 mt-0.5">
            {t(locale, 'brand.previewSubtitle')}
          </p>
        </div>
      </div>
      <div
        className="px-5 py-3 text-hero-ink text-sm font-semibold"
        style={{ backgroundColor: primary }}
      >
        QUOTE-001 · $450.00
      </div>
    </div>
  );
}

export default async function BrandPage() {
  const { businessId } = await requireAuth();
  const locale: Locale = await getLocale();
  const tr = (k: string) => t(locale, k);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      phone: true,
      logoUrl: true,
      tagline: true,
      brandColors: true,
      brandServices: true,
    },
  });

  if (!business) {
    return (
      <div className="space-y-6">
        <PageTitle title={tr('brand.title')} summary={tr('brand.subtitle')} />
      </div>
    );
  }

  const colors = parseBrandColors(business.brandColors);
  const services = parseBrandServices(business.brandServices);
  const tagline = business.tagline ?? '';

  const templates = buildSocialTemplates(
    {
      name: business.name,
      tagline: tagline || null,
      services,
      phone: business.phone,
    },
    locale
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title={tr('brand.title')}
        summary={tr('brand.subtitle')}
      />

      <section>
        <h2 className="text-xs font-bold text-ink-2 mb-2 px-1 flex items-center gap-1.5">
          <Palette size={14} aria-hidden /> {tr('brand.sectionBrand')}
        </h2>
        <Card className="p-5">
          <BrandKitForm
            locale={locale}
            initial={{
              tagline,
              primary: colors.primary,
              accent: colors.accent,
              services,
            }}
          />
        </Card>
      </section>

      <section>
        <h2 className="text-xs font-bold text-ink-2 mb-2 px-1">
          {tr('brand.previewTitle')}
        </h2>
        <BrandHeaderPreview
          name={business.name}
          tagline={tagline}
          logoUrl={business.logoUrl}
          primary={colors.primary}
          accent={colors.accent}
          locale={locale}
        />
      </section>

      <section>
        <h2 className="text-xs font-bold text-ink-2 mb-2 px-1">
          {tr('brand.templatesTitle')}
        </h2>
        <p className="text-sm text-ink-2 px-1 mb-3">{tr('brand.templatesSubtitle')}</p>
        <div className="space-y-3">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="p-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-bold text-ink">{tpl.title}</h3>
                <CopyButton
                  text={tpl.body}
                  label={tr('brand.copy')}
                  className="min-h-[44px]"
                />
              </div>
              <p className="text-sm text-ink whitespace-pre-line">{tpl.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
