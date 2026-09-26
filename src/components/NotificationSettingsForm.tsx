'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Card, primaryBtnClass } from '@/components/ui';
import { t, type Locale } from '@/lib/i18n';
import {
  NOTIFICATION_TYPES,
  type NotificationSettings,
  type NotificationType,
} from '@/lib/notification-prefs';
import { saveNotificationSettingsAction } from '@/app/actions/notifications';

/**
 * Per-type notification toggles for /settings. Plain-language labels, all on
 * by default. Unchecked boxes submit nothing — the server action reads every
 * known type explicitly (missing = off), so the form can never half-save.
 */
export default function NotificationSettingsForm({
  initial,
  locale = 'en',
  savedMessage,
}: {
  initial: NotificationSettings;
  locale?: Locale;
  savedMessage: string;
}) {
  const [values, setValues] = useState<NotificationSettings>(initial);
  const [saved, setSaved] = useState(false);

  const toggle = (key: NotificationType) =>
    setValues((v) => ({ ...v, [key]: !v[key] }));

  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
        <Bell size={14} /> {t(locale, 'notifications.settingsTitle')}
      </h2>
      <p className="text-xs text-zinc-500 mb-4">{t(locale, 'notifications.settingsHint')}</p>
      <form
        action={async (formData: FormData) => {
          await saveNotificationSettingsAction(formData);
          setSaved(true);
          toast.success(savedMessage);
        }}
        className="space-y-1"
      >
        {NOTIFICATION_TYPES.map((key) => (
          <label
            key={key}
            className="flex items-start gap-3 rounded-xl px-3 py-3 min-h-[52px] cursor-pointer hover:bg-zinc-50 transition-colors"
          >
            <input
              type="checkbox"
              name={`notify_${key}`}
              checked={values[key]}
              onChange={() => toggle(key)}
              className="mt-1 h-5 w-5 shrink-0 rounded accent-[#161616]"
            />
            <span>
              <span className="block text-[14px] font-semibold text-zinc-900">
                {t(locale, `notifications.type_${key}`)}
              </span>
              <span className="block text-xs text-zinc-500">
                {t(locale, `notifications.desc_${key}`)}
              </span>
            </span>
          </label>
        ))}
        <div className="pt-3 flex items-center gap-3">
          <button type="submit" className={primaryBtnClass}>
            {t(locale, 'notifications.saveSettings')}
          </button>
          {saved && (
            <p role="status" className="text-xs font-medium text-emerald-700">
              {savedMessage}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
