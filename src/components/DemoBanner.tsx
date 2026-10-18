import { leaveDemoBusiness } from '@/app/actions/demo';
import { t } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

/**
 * Part 0 (dashboard rebuild): persistent banner shown on every app screen
 * while the viewer is inside the demo business, so demo data is clearly
 * labelled "Demo" everywhere in the UI. Amber (not hi-vis lime) so the
 * banner never reads as a product action.
 */
export default function DemoBanner({ locale }: { locale: Locale }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 bg-warn px-4 py-1.5 text-center"
    >
      <span className="text-xs font-bold uppercase tracking-wide text-warn-text">
        {t(locale, 'demo.banner')}
      </span>
      <form action={leaveDemoBusiness}>
        <button
          type="submit"
          className="text-xs font-semibold text-warn-text underline underline-offset-2"
        >
          {t(locale, 'demo.backToBusiness')}
        </button>
      </form>
    </div>
  );
}
