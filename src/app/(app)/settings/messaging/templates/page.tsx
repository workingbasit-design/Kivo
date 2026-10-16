import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { PageHeader } from '@/components/ui';
import TemplateEditor from '@/components/TemplateEditor';
import Link from 'next/link';

export const metadata = { title: 'Message templates | EveryJob' };

export default async function TemplatesPage() {
  await requireAuth();
  const locale = await getLocale();
  const loc = locale === 'fr' ? 'fr' : 'en';

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={loc === 'fr' ? 'Modèles de messages' : 'Message templates'}
        subtitle={
          loc === 'fr'
            ? 'Personnalisez les messages automatiques. Laissez vide pour utiliser le modèle intégré.'
            : 'Customize automatic messages. Leave empty to use the built-in template.'
        }
      />
      <Link
        href="/settings/messaging"
        className="text-sm text-zinc-600 underline"
      >
        ← {loc === 'fr' ? 'Retour aux paramètres' : 'Back to settings'}
      </Link>
      <TemplateEditor locale={loc} />
    </div>
  );
}
