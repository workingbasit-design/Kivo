'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  getTemplateOverrides,
  saveTemplateOverride,
  deleteTemplateOverride,
} from '@/app/actions/template-overrides';
import { TEMPLATE_IDS, type MessageTemplateId } from '@/lib/messaging/templates';
import { useEffect } from 'react';

const VARIABLES = [
  '{customerName}',
  '{businessName}',
  '{jobTitle}',
  '{whenLabel}',
  '{invoiceNumber}',
  '{amountLabel}',
  '{payLink}',
  '{quoteNumber}',
];

const TEMPLATE_LABELS: Record<MessageTemplateId, { en: string; fr: string }> = {
  reminder_24h: { en: '24h reminder', fr: 'Rappel 24h' },
  reminder_dayof: { en: 'Day-of reminder', fr: 'Rappel jour même' },
  invoice_due: { en: 'Invoice due', fr: 'Facture due' },
  invoice_overdue: { en: 'Invoice overdue', fr: 'Facture en retard' },
  quote_followup_7d: { en: 'Quote follow-up (7d)', fr: 'Suivi soumission (7j)' },
  review_request: { en: 'Review request', fr: 'Demande d’avis' },
};

export default function TemplateEditor({
  locale,
}: {
  locale: 'en' | 'fr';
}) {
  const [overrides, setOverrides] = useState<Record<string, { subject: string; body: string }>>({});
  const [selected, setSelected] = useState<MessageTemplateId>('reminder_24h');
  const [editLocale, setEditLocale] = useState<'en' | 'fr'>(locale);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();
  // Track which template+locale the form fields reflect, so we can reset
  // them during render when the selection changes (React "adjust state
  // during render" pattern — avoids setState-in-effect cascading renders).
  const [formKey, setFormKey] = useState('');

  useEffect(() => {
    getTemplateOverrides().then(setOverrides);
  }, []);

  const key = `${selected}:${editLocale}`;
  if (formKey !== key) {
    setFormKey(key);
    const o = overrides[key];
    setSubject(o?.subject ?? '');
    setBody(o?.body ?? '');
  }

  const isCustom = !!overrides[key];

  function handleSave() {
    startTransition(async () => {
      const res = await saveTemplateOverride(selected, editLocale, subject, body);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(locale === 'fr' ? 'Modèle enregistré.' : 'Template saved.');
        const updated = await getTemplateOverrides();
        setOverrides(updated);
      }
    });
  }

  function handleReset() {
    startTransition(async () => {
      const res = await deleteTemplateOverride(selected, editLocale);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(locale === 'fr' ? 'Modèle réinitialisé.' : 'Template reset to built-in.');
        const updated = await getTemplateOverrides();
        setOverrides(updated);
      }
    });
  }

  function insertVar(v: string) {
    setBody((b) => b + v);
  }

  const t = (en: string, fr: string) => (locale === 'fr' ? fr : en);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {TEMPLATE_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setSelected(id)}
            className={`px-3 py-2 rounded text-sm ${
              selected === id
                ? 'bg-asphalt text-hero-ink'
                : 'bg-surface-2 text-ink'
            }`}
          >
            {TEMPLATE_LABELS[id][locale]}
            {overrides[`${id}:en`] || overrides[`${id}:fr`] ? ' ✎' : ''}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setEditLocale('en')}
          className={`px-3 py-1 rounded text-sm ${editLocale === 'en' ? 'bg-asphalt text-hero-ink' : 'bg-surface-2'}`}
        >
          English
        </button>
        <button
          onClick={() => setEditLocale('fr')}
          className={`px-3 py-1 rounded text-sm ${editLocale === 'fr' ? 'bg-asphalt text-hero-ink' : 'bg-surface-2'}`}
        >
          Français
        </button>
        {isCustom && (
          <span className="ml-2 px-2 py-1 bg-warn-bg text-warn-text rounded text-xs self-center">
            {t('Customized', 'Personnalisé')}
          </span>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t('Subject', 'Objet')}
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-2 border rounded"
          placeholder={t('Email subject line', 'Objet du courriel')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t('Body', 'Corps')}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border rounded font-mono text-sm"
          placeholder={t('Message body with {variables}', 'Corps du message avec {variables}')}
        />
        <p className="text-xs text-ink-2 mt-1">
          {t(
            'Must include "Reply STOP to opt out." for CASL compliance.',
            'Doit inclure « Répondez ARRÊT pour vous désinscrire. » pour conformité LCAP.'
          )}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t('Insert variable', 'Insérer une variable')}
        </label>
        <div className="flex gap-2 flex-wrap">
          {VARIABLES.map((v) => (
            <button
              key={v}
              onClick={() => insertVar(v)}
              className="px-2 py-1 bg-surface-2 rounded text-xs font-mono"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={pending || !subject.trim() || !body.trim()}
          className="px-4 py-2 bg-asphalt text-hero-ink rounded disabled:opacity-50"
        >
          {t('Save template', 'Enregistrer le modèle')}
        </button>
        {isCustom && (
          <button
            onClick={handleReset}
            disabled={pending}
            className="px-4 py-2 bg-line rounded"
          >
            {t('Reset to built-in', 'Réinitialiser')}
          </button>
        )}
      </div>
    </div>
  );
}
